import { getDataProvider } from "@/lib/data/provider";
import type { Form, FormField } from "@/lib/data/types";

export interface FormRow extends Form {
  fieldCount: number;
  responseCount: number;
  autoTagName?: string;
}

export async function listForms(): Promise<FormRow[]> {
  const db = getDataProvider();
  const [forms, fields, responses, tags] = await Promise.all([
    db.forms.list(),
    db.formFields.list(),
    db.formResponses.list(),
    db.tags.list(),
  ]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const fieldCount = new Map<string, number>();
  for (const f of fields) fieldCount.set(f.formId, (fieldCount.get(f.formId) ?? 0) + 1);
  const respCount = new Map<string, number>();
  for (const r of responses) respCount.set(r.formId, (respCount.get(r.formId) ?? 0) + 1);

  return forms
    .map((f) => ({
      ...f,
      fieldCount: fieldCount.get(f.id) ?? 0,
      responseCount: respCount.get(f.id) ?? 0,
      autoTagName: f.autoTagId ? tagName.get(f.autoTagId) : undefined,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export interface FormWithFields {
  form: Form;
  fields: FormField[];
  autoTagName?: string;
  responseCount: number;
}

export async function getForm(id: string): Promise<FormWithFields | null> {
  const db = getDataProvider();
  const form = await db.forms.get(id);
  if (!form) return null;
  const [fields, responses, tags] = await Promise.all([
    db.formFields.list(),
    db.formResponses.list(),
    db.tags.list(),
  ]);
  return {
    form,
    fields: fields.filter((f) => f.formId === id).sort((a, b) => a.order - b.order),
    autoTagName: form.autoTagId ? tags.find((t) => t.id === form.autoTagId)?.name : undefined,
    responseCount: responses.filter((r) => r.formId === id).length,
  };
}

export interface FormResponseRow {
  id: string;
  createdAt: string;
  friendId?: string;
  friendName: string;
  values: Record<string, string>;
}

export interface FormResponsesView {
  form: Form;
  fields: FormField[];
  rows: FormResponseRow[];
}

export async function getFormResponses(id: string): Promise<FormResponsesView | null> {
  const db = getDataProvider();
  const form = await db.forms.get(id);
  if (!form) return null;
  const [fields, responses, friends] = await Promise.all([
    db.formFields.list(),
    db.formResponses.list(),
    db.friends.list(),
  ]);
  const friendName = new Map(friends.map((f) => [f.id, f.displayName]));

  return {
    form,
    fields: fields.filter((f) => f.formId === id).sort((a, b) => a.order - b.order),
    rows: responses
      .filter((r) => r.formId === id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        friendId: r.friendId,
        friendName: r.friendId ? (friendName.get(r.friendId) ?? r.friendId) : "—",
        values: r.values,
      })),
  };
}
