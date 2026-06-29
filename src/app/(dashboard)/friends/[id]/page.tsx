import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Badge, FriendStatusBadge } from "@/components/ui/StatusBadge";
import { TagChip } from "@/components/ui/TagChip";
import { type AnswerItem, getFriendDetail } from "@/features/friends/queries";
import { getFriendReservations } from "@/features/reservations/queries";
import { assignTag, unassignTag } from "@/features/tags/actions";
import { listTags } from "@/features/tags/queries";

const RES_STATUS: Record<string, string> = {
  confirmed: "予約中",
  done: "来店済",
  cancelled: "キャンセル",
  noshow: "来店なし",
};

const fmtDateTime = (s?: string) => (s ? new Date(s).toLocaleString("ja-JP") : "—");

function AnswerList({ answers }: { answers: AnswerItem[] }) {
  if (answers.length === 0) {
    return <p className="px-3 pb-3 text-xs text-muted">回答項目がありません。</p>;
  }
  return (
    <dl className="border-t border-line px-3 py-2">
      {answers.map((a, i) => (
        <div key={i} className="flex gap-3 border-b border-line/60 py-1.5 last:border-0">
          <dt className="w-28 shrink-0 text-xs text-muted">{a.label}</dt>
          <dd className="flex-1 whitespace-pre-wrap break-words text-sm text-ink">{a.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{children}</span>
    </div>
  );
}

export default async function FriendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, allTags, reservations] = await Promise.all([
    getFriendDetail(id),
    listTags(),
    getFriendReservations(id),
  ]);
  if (!detail) notFound();

  const { friend, lineAccountName, tags, formHistory, surveyHistory } = detail;
  const assignedIds = new Set(tags.map((t) => t.tag.id));
  const availableTags = allTags.filter((t) => !assignedIds.has(t.id));

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <Link
        href="/friends"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        顧客一覧へ
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{friend.displayName}</h1>
        <FriendStatusBadge status={friend.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="基本情報" />
          <div className="px-5 py-2">
            <InfoRow label="LINEユーザーID">
              <span className="font-mono text-xs">{friend.lineUserId}</span>
            </InfoRow>
            <InfoRow label="登録LINE">{lineAccountName}</InfoRow>
            <InfoRow label="登録日時">{fmtDateTime(friend.registeredAt)}</InfoRow>
            <InfoRow label="最終クリック">{fmtDateTime(friend.lastClickAt)}</InfoRow>
            <InfoRow label="LTV">¥{friend.ltv.toLocaleString()}</InfoRow>
          </div>
        </Card>

        <Card>
          <CardHeader title="タグ" />
          <div className="space-y-4 p-5">
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((ref) => (
                  <span key={ref.friendTagId} className="inline-flex items-center gap-1">
                    <TagChip name={ref.tag.name} color={ref.tag.color} />
                    {ref.auto && <Badge tone="info">自動</Badge>}
                    <form action={unassignTag.bind(null, ref.friendTagId, friend.id)}>
                      <button
                        type="submit"
                        className="rounded p-0.5 text-faint transition hover:bg-surface-2 hover:text-danger"
                        title="タグを外す"
                      >
                        <X className="size-3.5" />
                      </button>
                    </form>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">タグはまだありません。</p>
            )}

            {availableTags.length > 0 && (
              <form action={assignTag.bind(null, friend.id)} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs text-muted">タグを追加</label>
                  <Select name="tagId" defaultValue="">
                    <option value="" disabled>
                      選択してください
                    </option>
                    {availableTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="outline" size="md">
                  <Plus className="size-4" />
                  付与
                </Button>
              </form>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="フォーム回答履歴" description={`${formHistory.length} 件`} />
          <div className="space-y-3 p-5">
            {formHistory.length ? (
              formHistory.map((r) => (
                <details key={r.id} className="rounded-lg border border-line bg-surface-2/40" open>
                  <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{r.formTitle}</span>
                    <span className="text-xs text-muted">{fmtDateTime(r.createdAt)}</span>
                  </summary>
                  <AnswerList answers={r.answers} />
                </details>
              ))
            ) : (
              <p className="text-sm text-muted">回答はありません。</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="アンケート回答履歴" description={`${surveyHistory.length} 件`} />
          <div className="space-y-3 p-5">
            {surveyHistory.length ? (
              surveyHistory.map((r) => (
                <details key={r.id} className="rounded-lg border border-line bg-surface-2/40" open>
                  <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{r.surveyTitle}</span>
                    <span className="text-xs text-muted">{fmtDateTime(r.createdAt)}</span>
                  </summary>
                  <AnswerList answers={r.answers} />
                </details>
              ))
            ) : (
              <p className="text-sm text-muted">回答はありません。</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="予約履歴" description={`${reservations.length} 件`} />
          <div className="p-5">
            {reservations.length ? (
              <ul className="space-y-2">
                {reservations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink">
                      {fmtDateTime(r.startAt)}
                      {r.menuName && <span className="ml-1 text-muted">／{r.menuName}</span>}
                    </span>
                    <span className="text-xs text-muted">{r.pageTitle}・{RES_STATUS[r.status] ?? r.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">予約はありません。</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
