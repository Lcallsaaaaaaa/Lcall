import { ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { FormField, Input } from "@/components/ui/Form";
import { createLandingPage, deleteLandingPage } from "@/features/landing-pages/actions";
import { listLandingPages, type LandingPageRow } from "@/features/landing-pages/queries";

export default async function LandingPagesPage() {
  const pages = await listLandingPages();

  const columns: Column<LandingPageRow>[] = [
    {
      key: "title",
      header: "LP",
      render: (p) => (
        <Link href={`/landing-pages/${p.id}`} className="font-medium text-ink hover:text-brand">
          {p.title}
        </Link>
      ),
    },
    { key: "slug", header: "スラッグ", render: (p) => <code className="text-xs text-muted">/lp/{p.slug}</code> },
    { key: "formTitle", header: "連携フォーム", render: (p) => (p.formTitle ? <span className="text-ink">{p.formTitle}</span> : <span className="text-faint">—</span>) },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <a href={`/lp/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink" title="公開LPを開く">
            <ExternalLink className="size-4" />
          </a>
          <form action={deleteLandingPage.bind(null, p.id)}>
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
        <h1 className="text-2xl font-semibold tracking-tight text-ink">LP管理</h1>
        <p className="mt-1 text-sm text-muted">簡易ランディングページを作成し、フォーム・決済リンクに繋ぎます。</p>
      </div>

      <Card className="mb-5">
        <CardHeader title="LPを作成" />
        <form action={createLandingPage} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="LP名" htmlFor="title" required className="min-w-48 flex-1">
            <Input id="title" name="title" placeholder="無料相談キャンペーン" required />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成
          </Button>
        </form>
      </Card>

      <Card>
        <DataTable columns={columns} rows={pages} getRowKey={(p) => p.id} empty="LPがまだありません。" />
      </Card>
    </div>
  );
}
