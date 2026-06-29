"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import type { FormField, FormFieldType } from "@/lib/data/types";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function parseFieldType(v: FormDataEntryValue | null): FormFieldType {
  const s = String(v ?? "");
  const ok: FormFieldType[] = ["text", "email", "tel", "select", "checkbox", "date", "textarea"];
  return (ok as string[]).includes(s) ? (s as FormFieldType) : "text";
}

export async function createForm(formData: FormData) {
  const id = uid("fm");
  await getDataProvider().forms.create({
    id,
    title: str(formData.get("title")) || "無題のフォーム",
    description: str(formData.get("description")) || undefined,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/forms");
  redirect(`/forms/${id}`);
}

/** 回答に既存のLINE顧客を手動で紐づける（?u 無しで入力された回答の救済）。 */
export async function linkFormResponseToFriend(responseId: string, formId: string, formData: FormData) {
  const friendId = str(formData.get("friendId"));
  if (friendId) await getDataProvider().formResponses.update(responseId, { friendId });
  revalidatePath(`/forms/${formId}/responses`);
}

export async function updateForm(id: string, formData: FormData) {
  await getDataProvider().forms.update(id, {
    title: str(formData.get("title")) || "無題のフォーム",
    description: str(formData.get("description")) || undefined,
    autoTagId: str(formData.get("autoTagId")) || undefined,
  });
  revalidatePath(`/forms/${id}`);
  revalidatePath("/forms");
}

export async function deleteForm(id: string) {
  const db = getDataProvider();
  const [fields, responses] = await Promise.all([db.formFields.list(), db.formResponses.list()]);
  await Promise.all([
    ...fields.filter((f) => f.formId === id).map((f) => db.formFields.remove(f.id)),
    ...responses.filter((r) => r.formId === id).map((r) => db.formResponses.remove(r.id)),
  ]);
  await db.forms.remove(id);
  revalidatePath("/forms");
  redirect("/forms");
}

export async function addFormField(formId: string, formData: FormData) {
  const db = getDataProvider();
  const type = parseFieldType(formData.get("type"));
  const existing = (await db.formFields.list()).filter((f) => f.formId === formId);
  const options =
    type === "select" || type === "checkbox"
      ? str(formData.get("options"))
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  await db.formFields.create({
    id: uid("ff"),
    formId,
    label: str(formData.get("label")) || "項目",
    type,
    required: formData.get("required") != null,
    order: existing.length,
    options,
  });
  revalidatePath(`/forms/${formId}`);
}

export async function deleteFormField(fieldId: string, formId: string) {
  await getDataProvider().formFields.remove(fieldId);
  revalidatePath(`/forms/${formId}`);
}

/** 項目の並び替え（隣と order を入れ替え）。 */
export async function moveFormField(fieldId: string, formId: string, dir: "up" | "down") {
  const db = getDataProvider();
  const fields = (await db.formFields.list())
    .filter((f) => f.formId === formId)
    .sort((a, b) => a.order - b.order);
  const idx = fields.findIndex((f) => f.id === fieldId);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= fields.length) return;
  const a = fields[idx];
  const b = fields[swap];
  await db.formFields.update(a.id, { order: b.order });
  await db.formFields.update(b.id, { order: a.order });
  revalidatePath(`/forms/${formId}`);
}

/** 公開フォームの送信（§5 回答時タグ付け）。 */
export async function submitFormResponse(formId: string, formData: FormData) {
  const db = getDataProvider();
  const form = await db.forms.get(formId);
  if (!form) redirect("/");
  const fields: FormField[] = (await db.formFields.list()).filter((f) => f.formId === formId);

  const values: Record<string, string> = {};
  for (const f of fields) {
    const v =
      f.type === "checkbox" ? formData.getAll(f.id).map(String).join(", ") : str(formData.get(f.id));
    if (v) values[f.id] = v;
  }
  const friendId = str(formData.get("u")) || undefined;

  await db.formResponses.create({
    id: uid("fres"),
    formId,
    friendId,
    values,
    createdAt: new Date().toISOString(),
  });

  if (form.autoTagId && friendId) {
    const fts = await db.friendTags.list();
    if (!fts.some((ft) => ft.friendId === friendId && ft.tagId === form.autoTagId)) {
      await db.friendTags.create({
        id: uid("ft"),
        friendId,
        tagId: form.autoTagId,
        auto: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  revalidatePath(`/forms/${formId}/responses`);
  redirect(`/f/${formId}?submitted=1`);
}
