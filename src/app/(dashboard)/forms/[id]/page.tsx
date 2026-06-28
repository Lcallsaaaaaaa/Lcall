import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import {
  addFormField,
  deleteForm,
  deleteFormField,
  moveFormField,
  updateForm,
} from "@/features/forms/actions";
import { FIELD_TYPE_LABEL } from "@/features/forms/labels";
import { getForm } from "@/features/forms/queries";
import { listTags } from "@/features/tags/queries";
import type { FormFieldType } from "@/lib/data/types";

const TYPE_OPTIONS: FormFieldType[] = ["text", "email", "tel", "select", "checkbox", "date", "textarea"];

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, tags, h] = await Promise.all([getForm(id), listTags(), headers()]);
  if (!data) notFound();
  const { form, fields, responseCount } = data;

  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicUrl = `${proto}://${host}/f/${id}`;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link href="/forms" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        申込フォーム一覧へ
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{form.title}</h1>
        <Link href={`/forms/${id}/responses`} className={buttonClasses("outline", "sm")}>
          回答一覧（{responseCount}）
        </Link>
      </div>

      {/* 公開URL */}
      <Card className="mb-5">
        <CardHeader title="公開フォーム" />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted" />
            <code className="truncate text-xs text-ink">{publicUrl}</code>
          </div>
          <a href={`/f/${id}`} target="_blank" rel="noreferrer" className={buttonClasses("outline", "md")}>
            <ExternalLink className="size-4" />
            開く
          </a>
        </div>
      </Card>

      {/* 設定 */}
      <Card className="mb-5">
        <CardHeader title="設定" />
        <form action={updateForm.bind(null, id)} className="space-y-4 p-5">
          <FormField label="フォーム名" htmlFor="title" required>
            <Input id="title" name="title" defaultValue={form.title} required />
          </FormField>
          <FormField label="説明" htmlFor="description">
            <Input id="description" name="description" defaultValue={form.description} />
          </FormField>
          <FormField label="回答時に付与するタグ" htmlFor="autoTagId">
            <Select id="autoTagId" name="autoTagId" defaultValue={form.autoTagId ?? ""}>
              <option value="">なし</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" variant="solid" size="md">
              保存
            </Button>
          </div>
        </form>
      </Card>

      {/* 項目 */}
      <Card className="mb-5">
        <CardHeader title="項目" description={`${fields.length}項目`} />
        <div className="divide-y divide-line">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{f.label}</span>
                  <Badge tone="neutral">{FIELD_TYPE_LABEL[f.type]}</Badge>
                  {f.required && <Badge tone="warn">必須</Badge>}
                </div>
                {f.options && f.options.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted">選択肢: {f.options.join(" / ")}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <form action={moveFormField.bind(null, f.id, id, "up")}>
                  <button type="submit" disabled={i === 0} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                    <ChevronUp className="size-4" />
                  </button>
                </form>
                <form action={moveFormField.bind(null, f.id, id, "down")}>
                  <button type="submit" disabled={i === fields.length - 1} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                    <ChevronDown className="size-4" />
                  </button>
                </form>
                <form action={deleteFormField.bind(null, f.id, id)}>
                  <button type="submit" className="rounded p-1 text-muted hover:bg-danger-bg hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </div>
          ))}
          {fields.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">項目がありません。下から追加してください。</p>}
        </div>

        <form action={addFormField.bind(null, id)} className="space-y-4 border-t border-line p-5">
          <p className="text-sm font-medium text-ink">項目を追加</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="ラベル" htmlFor="label" required>
              <Input id="label" name="label" placeholder="お名前" required />
            </FormField>
            <FormField label="種別" htmlFor="type">
              <Select id="type" name="type" defaultValue="text">
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="選択肢" htmlFor="options" hint="選択式・チェックボックスのみ。1行に1つ。">
            <Textarea id="options" name="options" placeholder={"選択肢A\n選択肢B"} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="required" className="accent-[#dd2a7b]" />
            必須項目にする
          </label>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" size="md">
              <Plus className="size-4" />
              項目を追加
            </Button>
          </div>
        </form>
      </Card>

      {/* 削除 */}
      <Card>
        <CardHeader title="削除" description="このフォームと項目・回答を削除します。" />
        <div className="p-5">
          <form action={deleteForm.bind(null, id)}>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg">
              <Trash2 className="size-4" />
              このフォームを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
