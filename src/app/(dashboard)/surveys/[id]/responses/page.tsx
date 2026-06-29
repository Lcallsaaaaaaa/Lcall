import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { linkSurveyResponseToFriend } from "@/features/surveys/actions";
import { getSurveyResponses } from "@/features/surveys/queries";
import { getDataProvider } from "@/lib/data/provider";

const fmtDate = (s: string) => new Date(s).toLocaleString("ja-JP");

export default async function SurveyResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSurveyResponses(id);
  if (!data) notFound();
  const { survey, questions, rows } = data;
  const friends = (await getDataProvider().friends.list()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "ja")
  );

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <Link href={`/surveys/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        アンケート編集へ
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{survey.title}</h1>
          <p className="mt-1 text-sm text-muted">回答 {rows.length} 件</p>
        </div>
        <a href={`/api/export/survey-responses?surveyId=${id}`} className={buttonClasses("outline", "md")}>
          <Download className="size-4" />
          CSV出力
        </a>
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">まだ回答がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">日時</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">顧客</th>
                  {questions.map((q) => (
                    <th key={q.id} className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                      {q.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{fmtDate(r.createdAt)}</td>
                    <td className="px-5 py-3 text-ink">
                      {r.friendId ? (
                        <Link href={`/inbox?f=${r.friendId}`} className="text-brand hover:underline">{r.friendName}</Link>
                      ) : (
                        <form action={linkSurveyResponseToFriend.bind(null, r.id, id)} className="flex items-center gap-1">
                          <Select name="friendId" defaultValue="" className="h-7 max-w-[140px] text-xs">
                            <option value="" disabled>LINE顧客を紐づけ…</option>
                            {friends.map((f) => (
                              <option key={f.id} value={f.id}>{f.displayName}</option>
                            ))}
                          </Select>
                          <button type="submit" className="rounded border border-line px-1.5 py-0.5 text-xs text-ink hover:bg-surface-2">紐づけ</button>
                        </form>
                      )}
                    </td>
                    {questions.map((q) => (
                      <td key={q.id} className="px-5 py-3 text-ink">
                        {r.values[q.id] !== undefined ? String(r.values[q.id]) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
