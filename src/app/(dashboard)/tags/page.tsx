import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { FormField, Input } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { TagChip } from "@/components/ui/TagChip";
import { createTag, deleteTag } from "@/features/tags/actions";
import { listTagsWithMeta, type TagWithMeta } from "@/features/tags/queries";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, tags] = await Promise.all([searchParams, listTagsWithMeta()]);

  const columns: Column<TagWithMeta>[] = [
    { key: "name", header: "タグ", render: (t) => <TagChip name={t.name} color={t.color} /> },
    {
      key: "friendCount",
      header: "付与数",
      align: "right",
      render: (t) => <span className="tabular-nums">{t.friendCount.toLocaleString()}</span>,
    },
    {
      key: "auto",
      header: "自動付与",
      render: (t) =>
        t.auto ? <Badge tone="info">クリックで自動付与</Badge> : <span className="text-faint">—</span>,
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (t) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/tags/${t.id}/edit`}
            className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
            title="編集"
          >
            <Pencil className="size-4" />
          </Link>
          <form action={deleteTag.bind(null, t.id)}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger"
              title="削除"
            >
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
        <h1 className="text-2xl font-semibold tracking-tight text-ink">タグ管理</h1>
        <p className="mt-1 text-sm text-muted">
          顧客の分類に使うタグを管理します。クリック計測による自動付与にも利用します。
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title="タグを作成" />
        <form action={createTag} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="タグ名" htmlFor="name" required className="min-w-48 flex-1">
            <Input id="name" name="name" placeholder="VIP / 新規 / 未購入 ..." required />
          </FormField>
          <FormField label="色" htmlFor="color">
            <input
              id="color"
              name="color"
              type="color"
              defaultValue="#dd2a7b"
              className="h-10 w-16 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
            />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成
          </Button>
        </form>
        {error === "name" && (
          <p className="px-5 pb-4 text-sm text-danger">タグ名を入力してください。</p>
        )}
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={tags}
          getRowKey={(t) => t.id}
          empty="タグがまだありません。上のフォームから作成してください。"
        />
      </Card>
    </div>
  );
}
