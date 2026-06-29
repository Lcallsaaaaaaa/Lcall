/* eslint-disable @next/next/no-img-element */
import { Inbox, Plus, RefreshCcw, X } from "lucide-react";
import Link from "next/link";
import { ChatComposer } from "@/components/features/ChatComposer";
import { MarkReadOnOpen } from "@/components/features/MarkReadOnOpen";
import { ProfilePanelToggle } from "@/components/features/ProfilePanelToggle";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Select } from "@/components/ui/Form";
import { TagChip } from "@/components/ui/TagChip";
import {
  refreshProfile,
  renameFriend,
  sendCarousel,
  sendReply,
  setFriendCharacter,
  simulateInbound,
  toggleAiPaused,
} from "@/features/chat/actions";
import { getThread, listThreads, recentAddedFriends } from "@/features/chat/queries";
import { getFriendDetail } from "@/features/friends/queries";
import { getFriendReservations } from "@/features/reservations/queries";
import { listBroadcasts } from "@/features/broadcasts/queries";
import { listMessageTemplates } from "@/features/message-templates/queries";
import { assignTag, unassignTag } from "@/features/tags/actions";
import { listTags } from "@/features/tags/queries";
import { cn } from "@/lib/cn";

function fmtTime(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** 登録日からの経過日数（本日=0日）。 */
function daysSince(s?: string): string {
  if (!s) return "—";
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  return d <= 0 ? "本日" : `${d}日`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const [threads, thread, allTags, templates, broadcasts, recentAdded, friendDetail, friendReservations] =
    await Promise.all([
      listThreads(),
      f ? getThread(f) : null,
      listTags(),
      listMessageTemplates(),
      listBroadcasts(),
      recentAddedFriends(),
      f ? getFriendDetail(f) : Promise.resolve(null),
      f ? getFriendReservations(f) : Promise.resolve([]),
    ]);
  const formHistory = friendDetail?.formHistory ?? [];
  const surveyHistory = friendDetail?.surveyHistory ?? [];
  const friendPhone = friendDetail?.phone;
  const RES_STATUS: Record<string, string> = {
    pending: "支払い待ち",
    confirmed: "予約中",
    done: "来店済",
    cancelled: "キャンセル",
    noshow: "来店なし",
  };
  const threadFriendIds = new Set(threads.map((t) => t.friendId));
  const recentNew = recentAdded.filter((r) => !threadFriendIds.has(r.friendId));
  const carousels = broadcasts.filter((b) => b.type === "carousel");
  const unreadCount = thread?.messages.filter((m) => m.direction === "in" && !m.read).length ?? 0;
  const assignedTagIds = new Set(thread?.tags.map((t) => t.tag.id));
  const availableTags = allTags.filter((t) => !assignedTagIds.has(t.id));

  return (
    <div className="flex h-full overflow-hidden">
      {/* スレッド一覧 */}
      <aside className="flex w-[30%] shrink-0 flex-col border-r border-line bg-surface md:w-56">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4 text-sm font-semibold text-ink">
          <Inbox className="size-4 text-muted" />
          チャット対応
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul>
          {threads.length === 0 && <li className="p-4 text-sm text-muted">スレッドがありません。</li>}
          {threads.map((t) => {
            const active = t.friendId === f;
            return (
              <li key={t.friendId}>
                <Link
                  href={`/inbox?f=${t.friendId}`}
                  className={cn(
                    "block border-b border-line px-4 py-3 transition",
                    active ? "bg-surface-2" : "hover:bg-surface-2/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-ink">{t.friendName}</span>
                    <span className="shrink-0 text-[11px] text-faint">{fmtTime(t.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-muted">
                      {t.lastDirection === "out" && "↩ "}
                      {t.lastText}
                    </span>
                    {t.unread > 0 && (
                      <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-medium text-white">
                        {t.unread}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
          </ul>

          {recentNew.length > 0 && (
            <div className="border-t border-line">
              <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-faint">
                最近の友だち追加
              </p>
              <ul>
                {recentNew.map((r) => {
                  const active = r.friendId === f;
                  return (
                    <li key={r.friendId}>
                      <Link
                        href={`/inbox?f=${r.friendId}`}
                        className={cn(
                          "block border-b border-line px-4 py-2.5 transition",
                          active ? "bg-surface-2" : "hover:bg-surface-2/60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-ink">{r.friendName}</span>
                          <span className="shrink-0 text-[11px] text-faint">
                            {new Date(r.registeredAt).toLocaleDateString("ja-JP", {
                              month: "numeric",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted">
                          {r.lineAccountName ?? "—"} · メッセージなし
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* スレッド本体 */}
      <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
        {!thread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            左のスレッドを選択してください。
          </div>
        ) : (
          <>
            <MarkReadOnOpen friendId={thread.friend.id} hasUnread={unreadCount > 0} />
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-4">
              <span className="font-medium text-ink">{thread.friend.displayName}</span>
              <div className="flex items-center gap-2">
                <ProfilePanelToggle />
                {thread.aiEnabled && (
                  <form action={toggleAiPaused.bind(null, thread.friend.id)}>
                    <button
                      type="submit"
                      title={thread.friend.aiPaused ? "AIを再開する" : "AIを一時停止（有人対応に切替）"}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition",
                        thread.friend.aiPaused
                          ? "border-line text-muted hover:bg-surface-2 hover:text-ink"
                          : "border-brand/40 bg-brand/5 text-brand hover:bg-brand/10"
                      )}
                    >
                      {thread.friend.aiPaused ? "AI停止中 · 再開" : "AI稼働中 · 停止"}
                    </button>
                  </form>
                )}
                <form action={simulateInbound.bind(null, thread.friend.id)}>
                  <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink">
                    受信をシミュレート
                  </button>
                </form>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {thread.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                      m.direction === "out" ? "gradient-bg text-white" : "border border-line bg-surface text-ink"
                    )}
                  >
                    {m.imageUrl ? (
                      <a href={m.imageUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={m.imageUrl} alt="受信画像" className="max-h-60 max-w-full rounded-lg" />
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    )}
                    <div className={cn("mt-1 text-[10px]", m.direction === "out" ? "text-white/70" : "text-faint")}>
                      {fmtTime(m.createdAt)}
                      {m.staffName ? ` · ${m.staffName}` : ""}
                      {m.direction === "in" && !m.read ? " · 未読" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 返信（定型文を挿入して編集／Ctrl+Enter送信）＋カルーセル */}
            <div className="shrink-0 space-y-2 border-t border-line bg-surface p-3">
              <ChatComposer
                action={sendReply.bind(null, thread.friend.id)}
                templates={templates}
                friendName={thread.friend.displayName}
              />
              {carousels.length > 0 && (
                <form action={sendCarousel.bind(null, thread.friend.id)} className="flex items-center gap-1">
                  <Select name="broadcastId" defaultValue="" className="h-9 w-48 text-xs">
                    <option value="">カルーセルを選択…</option>
                    {carousels.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.cardCount === 0}>
                        {c.title}（{c.cardCount > 0 ? `${c.cardCount}枚` : "カード未追加"}）
                      </option>
                    ))}
                  </Select>
                  <SubmitButton className="rounded-md border border-line px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-ink">
                    カルーセル送信
                  </SubmitButton>
                </form>
              )}
            </div>
          </>
        )}
      </section>

      {/* プロフィールパネル */}
      {thread && (
        <aside id="chat-profile" className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-line bg-surface p-4 lg:flex">
          <div className="flex flex-col items-center text-center">
            {thread.friend.pictureUrl ? (
              <img src={thread.friend.pictureUrl} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-xl font-semibold text-ink">
                {thread.friend.displayName.charAt(0)}
              </span>
            )}
            <form action={renameFriend.bind(null, thread.friend.id)} className="mt-3 flex w-full items-center gap-1">
              <input
                name="name"
                defaultValue={thread.friend.displayName}
                className="h-8 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-brand"
              />
              <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink">
                改名
              </button>
            </form>
          </div>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">ユーザーID</dt>
              <dd className="truncate font-mono text-xs text-ink">{thread.friend.lineUserId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">電話番号</dt>
              <dd className="text-ink">{friendPhone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">登録LINE</dt>
              <dd className="text-ink">{thread.lineAccountName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">流入元</dt>
              <dd className="text-ink">{thread.sourceLabel ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">登録日</dt>
              <dd className="text-ink">{new Date(thread.friend.registeredAt).toLocaleDateString("ja-JP")}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">登録からの日数</dt>
              <dd className="text-ink">{daysSince(thread.friend.registeredAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">LTV</dt>
              <dd className="text-ink">¥{thread.friend.ltv.toLocaleString()}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium text-ink">タグ</p>
            <div className="flex flex-wrap gap-1.5">
              {thread.tags.map((ref) => (
                <span key={ref.friendTagId} className="inline-flex items-center gap-1">
                  <TagChip name={ref.tag.name} color={ref.tag.color} />
                  <form action={unassignTag.bind(null, ref.friendTagId, thread.friend.id)}>
                    <button type="submit" className="rounded p-0.5 text-faint hover:text-danger" title="外す">
                      <X className="size-3" />
                    </button>
                  </form>
                </span>
              ))}
              {thread.tags.length === 0 && <span className="text-xs text-muted">なし</span>}
            </div>
            {availableTags.length > 0 && (
              <form action={assignTag.bind(null, thread.friend.id)} className="mt-2 flex items-center gap-1">
                <Select name="tagId" defaultValue="" className="h-8 flex-1 text-xs">
                  <option value="" disabled>
                    タグを追加…
                  </option>
                  {availableTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <button type="submit" className="rounded-md border border-line p-1.5 text-muted hover:bg-surface-2 hover:text-ink" title="付与">
                  <Plus className="size-3.5" />
                </button>
              </form>
            )}
          </div>

          {(formHistory.length > 0 || surveyHistory.length > 0 || friendReservations.length > 0) && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <p className="text-sm font-medium text-ink">回答・予約</p>

              {formHistory.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">申込フォーム</p>
                  <div className="space-y-1">
                    {formHistory.map((r) => (
                      <details key={r.id} className="rounded border border-line bg-surface-2/40 text-xs">
                        <summary className="cursor-pointer px-2 py-1 text-ink">{r.formTitle}</summary>
                        <dl className="border-t border-line px-2 py-1">
                          {r.answers.map((a, i) => (
                            <div key={i} className="flex gap-2 py-0.5">
                              <dt className="w-14 shrink-0 text-faint">{a.label}</dt>
                              <dd className="flex-1 whitespace-pre-wrap break-words text-ink">{a.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {surveyHistory.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">アンケート</p>
                  <div className="space-y-1">
                    {surveyHistory.map((r) => (
                      <details key={r.id} className="rounded border border-line bg-surface-2/40 text-xs">
                        <summary className="cursor-pointer px-2 py-1 text-ink">{r.surveyTitle}</summary>
                        <dl className="border-t border-line px-2 py-1">
                          {r.answers.map((a, i) => (
                            <div key={i} className="flex gap-2 py-0.5">
                              <dt className="w-14 shrink-0 text-faint">{a.label}</dt>
                              <dd className="flex-1 whitespace-pre-wrap break-words text-ink">{a.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {friendReservations.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">予約</p>
                  <ul className="space-y-1 text-xs">
                    {friendReservations.map((r) => (
                      <li key={r.id} className="rounded border border-line bg-surface-2/40 px-2 py-1">
                        <span className="text-ink">
                          {new Date(r.startAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {r.menuName && <span className="text-muted">／{r.menuName}</span>}
                        <span className="ml-1 text-faint">（{RES_STATUS[r.status] ?? r.status}）</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {thread.aiEnabled && (
            <form
              action={setFriendCharacter.bind(null, thread.friend.id)}
              className="mt-4 border-t border-line pt-4"
            >
              <p className="mb-2 text-sm font-medium text-ink">AIキャラ（この友だち）</p>
              <div className="flex items-center gap-1">
                <Select
                  name="aiCharacterId"
                  defaultValue={thread.friend.aiCharacterId ?? ""}
                  className="h-8 flex-1 text-xs"
                >
                  <option value="">自動（タグ／アカウント既定）</option>
                  {thread.aiCharacters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <button
                  type="submit"
                  className="rounded-md border border-line px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-ink"
                >
                  適用
                </button>
              </div>
            </form>
          )}

          <form action={refreshProfile.bind(null, thread.friend.id)} className="mt-4 border-t border-line pt-4">
            <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">
              <RefreshCcw className="size-4" />
              LINEプロフィール再取得
            </button>
            <p className="mt-1 text-center text-[11px] text-faint">実トークン設定時に有効</p>
          </form>
        </aside>
      )}
    </div>
  );
}
