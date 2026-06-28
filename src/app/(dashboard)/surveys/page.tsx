import { ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { FormField, Input } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { createSurvey, deleteSurvey } from "@/features/surveys/actions";
import { listSurveys, type SurveyRow } from "@/features/surveys/queries";

export default async function SurveysPage() {
  const surveys = await listSurveys();

  const columns: Column<SurveyRow>[] = [
    {
      key: "title",
      header: "アンケート",
      render: (s) => (
        <Link href={`/surveys/${s.id}`} className="font-medium text-ink hover:text-brand">
          {s.title}
        </Link>
      ),
    },
    { key: "questionCount", header: "設問数", align: "right", render: (s) => <span className="tabular-nums">{s.questionCount}</span> },
    {
      key: "responseCount",
      header: "回答数",
      align: "right",
      render: (s) => (
        <Link href={`/surveys/${s.id}/responses`} className="tabular-nums text-brand hover:underline">
          {s.responseCount}
        </Link>
      ),
    },
    {
      key: "autoTag",
      header: "回答時タグ",
      render: (s) => (s.autoTagName ? <Badge tone="info">{s.autoTagName}</Badge> : <span className="text-faint">—</span>),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <a href={`/s/${s.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink" title="公開アンケートを開く">
            <ExternalLink className="size-4" />
          </a>
          <form action={deleteSurvey.bind(null, s.id)}>
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
        <h1 className="text-2xl font-semibold tracking-tight text-ink">アンケート</h1>
        <p className="mt-1 text-sm text-muted">5段階評価・選択式・自由記述のアンケートを作成し、回答を分析します。</p>
      </div>

      <Card className="mb-5">
        <CardHeader title="アンケートを作成" />
        <form action={createSurvey} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="アンケート名" htmlFor="title" required className="min-w-48 flex-1">
            <Input id="title" name="title" placeholder="サービス満足度アンケート" required />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成
          </Button>
        </form>
      </Card>

      <Card>
        <DataTable columns={columns} rows={surveys} getRowKey={(s) => s.id} empty="アンケートがまだありません。" />
      </Card>
    </div>
  );
}
