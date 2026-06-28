import { ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/StatusBadge";
import { FormField, Input } from "@/components/ui/Form";
import { createForm, deleteForm } from "@/features/forms/actions";
import { listForms, type FormRow } from "@/features/forms/queries";

export default async function FormsPage() {
  const forms = await listForms();

  const columns: Column<FormRow>[] = [
    {
      key: "title",
      header: "フォーム",
      render: (f) => (
        <Link href={`/forms/${f.id}`} className="font-medium text-ink hover:text-brand">
          {f.title}
        </Link>
      ),
    },
    { key: "fieldCount", header: "項目数", align: "right", render: (f) => <span className="tabular-nums">{f.fieldCount}</span> },
    {
      key: "responseCount",
      header: "回答数",
      align: "right",
      render: (f) => (
        <Link href={`/forms/${f.id}/responses`} className="tabular-nums text-brand hover:underline">
          {f.responseCount}
        </Link>
      ),
    },
    {
      key: "autoTag",
      header: "回答時タグ",
      render: (f) => (f.autoTagName ? <Badge tone="info">{f.autoTagName}</Badge> : <span className="text-faint">—</span>),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (f) => (
        <div className="flex items-center justify-end gap-2">
          <a
            href={`/f/${f.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
            title="公開フォームを開く"
          >
            <ExternalLink className="size-4" />
          </a>
          <form action={deleteForm.bind(null, f.id)}>
            <button type="submit" className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger" title="削除">
              <Trash2 className="size-4" />
            </button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">申込フォーム</h1>
        <p className="mt-1 text-sm text-muted">申込・問い合わせフォームを作成し、回答を集めます。</p>
      </div>

      <Card className="mb-5">
        <CardHeader title="フォームを作成" />
        <form action={createForm} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="フォーム名" htmlFor="title" required className="min-w-48 flex-1">
            <Input id="title" name="title" placeholder="無料相談 申込フォーム" required />
          </FormField>
          <FormField label="説明（任意）" htmlFor="description" className="min-w-48 flex-1">
            <Input id="description" name="description" />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成
          </Button>
        </form>
      </Card>

      <Card>
        <DataTable columns={columns} rows={forms} getRowKey={(f) => f.id} empty="フォームがまだありません。" />
      </Card>
    </div>
  );
}
