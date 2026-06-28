import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import {
  addSurveyQuestion,
  deleteSurvey,
  deleteSurveyQuestion,
  moveSurveyQuestion,
  updateSurvey,
} from "@/features/surveys/actions";
import { QUESTION_TYPE_LABEL } from "@/features/surveys/labels";
import { getSurvey, getSurveyAnalysis } from "@/features/surveys/queries";
import { listTags } from "@/features/tags/queries";

function DistBars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate text-sm text-ink">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: "#515bd4" }} />
          </div>
          <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function SurveyBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, analysis, tags, h] = await Promise.all([
    getSurvey(id),
    getSurveyAnalysis(id),
    listTags(),
    headers(),
  ]);
  if (!data || !analysis) notFound();
  const { survey, questions, responseCount } = data;

  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicUrl = `${proto}://${host}/s/${id}`;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link href="/surveys" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        アンケート一覧へ
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{survey.title}</h1>
        <Link href={`/surveys/${id}/responses`} className={buttonClasses("outline", "sm")}>
          回答一覧（{responseCount}）
        </Link>
      </div>

      {/* 公開URL */}
      <Card className="mb-5">
        <CardHeader title="公開アンケート" />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted" />
            <code className="truncate text-xs text-ink">{publicUrl}</code>
          </div>
          <a href={`/s/${id}`} target="_blank" rel="noreferrer" className={buttonClasses("outline", "md")}>
            <ExternalLink className="size-4" />
            開く
          </a>
        </div>
      </Card>

      {/* 分析 */}
      <Card className="mb-5">
        <CardHeader title="分析" description={`回答 ${analysis.total} 件`} />
        <div className="space-y-6 p-5">
          {analysis.questions.length === 0 && <p className="text-sm text-muted">設問がありません。</p>}
          {analysis.questions.map((qa) => (
            <div key={qa.question.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium text-ink">{qa.question.label}</span>
                <Badge tone="neutral">{QUESTION_TYPE_LABEL[qa.question.type]}</Badge>
                {qa.average !== undefined && (
                  <span className="text-sm text-muted">平均 {qa.average.toFixed(2)} / 5</span>
                )}
              </div>
              {qa.distribution && <DistBars rows={qa.distribution} />}
              {qa.answers && (
                <ul className="space-y-1">
                  {qa.answers.length === 0 && <li className="text-sm text-muted">回答なし</li>}
                  {qa.answers.map((a, i) => (
                    <li key={i} className="rounded bg-surface-2 px-3 py-1.5 text-sm text-ink">
                      {a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 設定 */}
      <Card className="mb-5">
        <CardHeader title="設定" />
        <form action={updateSurvey.bind(null, id)} className="space-y-4 p-5">
          <FormField label="アンケート名" htmlFor="title" required>
            <Input id="title" name="title" defaultValue={survey.title} required />
          </FormField>
          <FormField label="回答時に付与するタグ" htmlFor="autoTagId">
            <Select id="autoTagId" name="autoTagId" defaultValue={survey.autoTagId ?? ""}>
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

      {/* 設問 */}
      <Card className="mb-5">
        <CardHeader title="設問" description={`${questions.length}問`} />
        <div className="divide-y divide-line">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{q.label}</span>
                  <Badge tone="neutral">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                </div>
                {q.options && q.options.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted">選択肢: {q.options.join(" / ")}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <form action={moveSurveyQuestion.bind(null, q.id, id, "up")}>
                  <button type="submit" disabled={i === 0} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                    <ChevronUp className="size-4" />
                  </button>
                </form>
                <form action={moveSurveyQuestion.bind(null, q.id, id, "down")}>
                  <button type="submit" disabled={i === questions.length - 1} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                    <ChevronDown className="size-4" />
                  </button>
                </form>
                <form action={deleteSurveyQuestion.bind(null, q.id, id)}>
                  <button type="submit" className="rounded p-1 text-muted hover:bg-danger-bg hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </div>
          ))}
          {questions.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">設問がありません。下から追加してください。</p>}
        </div>

        <form action={addSurveyQuestion.bind(null, id)} className="space-y-4 border-t border-line p-5">
          <p className="text-sm font-medium text-ink">設問を追加</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="設問文" htmlFor="label" required>
              <Input id="label" name="label" placeholder="総合満足度" required />
            </FormField>
            <FormField label="種別" htmlFor="type">
              <Select id="type" name="type" defaultValue="rating5">
                <option value="rating5">5段階評価</option>
                <option value="select">選択式</option>
                <option value="textarea">自由記述</option>
              </Select>
            </FormField>
          </div>
          <FormField label="選択肢" htmlFor="options" hint="選択式のみ。1行に1つ。">
            <Textarea id="options" name="options" placeholder={"選択肢A\n選択肢B"} />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" size="md">
              <Plus className="size-4" />
              設問を追加
            </Button>
          </div>
        </form>
      </Card>

      {/* 削除 */}
      <Card>
        <CardHeader title="削除" description="このアンケートと設問・回答を削除します。" />
        <div className="p-5">
          <form action={deleteSurvey.bind(null, id)}>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg">
              <Trash2 className="size-4" />
              このアンケートを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
