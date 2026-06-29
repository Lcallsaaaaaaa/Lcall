import { ArrowLeft, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import {
  addReservationMenu,
  addReservationOption,
  deleteReservationPage,
  removeReservationMenu,
  setReservationStatus,
  updateReservationPage,
} from "@/features/reservations/actions";
import { getPageReservations, getReservationPage } from "@/features/reservations/queries";
import { listTags } from "@/features/tags/queries";
import { publicBaseUrl } from "@/lib/url";

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const fmt = (s: string) => new Date(s).toLocaleString("ja-JP", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

const STATUS: Record<string, { label: string; tone: "ok" | "neutral" | "warn" | "danger" }> = {
  confirmed: { label: "予約中", tone: "ok" },
  done: { label: "来店済", tone: "neutral" },
  cancelled: { label: "キャンセル", tone: "danger" },
  noshow: { label: "来店なし", tone: "warn" },
};

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, rows, tags, base] = await Promise.all([
    getReservationPage(id),
    getPageReservations(id),
    listTags(),
    publicBaseUrl(),
  ]);
  if (!detail) notFound();
  const { page, menus, options } = detail;
  const publicUrl = `${base}/yoyaku/${id}`;
  const perFriendUrl = `${publicUrl}?u={friendId}`;

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <Link href="/reservations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        予約表一覧へ
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{page.title}</h1>
        <Badge tone={page.type === "menu" ? "info" : "neutral"}>{page.type === "menu" ? "メニュー型" : "シンプル"}</Badge>
      </div>

      {/* 公開URL */}
      <Card className="mb-5">
        <CardHeader title="公開予約ページ" />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted" />
            <code className="truncate text-xs text-ink">{publicUrl}</code>
          </div>
          <a href={`/yoyaku/${id}`} target="_blank" rel="noreferrer" className={buttonClasses("outline", "md")}>
            <ExternalLink className="size-4" />
            開く
          </a>
        </div>
        <div className="border-t border-line px-5 py-4">
          <p className="text-xs font-medium text-ink">配信用URL（予約者をLINE名で記録）</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted" />
            <code className="truncate text-xs text-ink">{perFriendUrl}</code>
          </div>
          <p className="mt-2 text-xs text-muted">
            配信・シナリオ・チャットの本文にこのURLを貼ると <code className="text-ink">{"{friendId}"}</code> が送信先ごとに置換され、予約が友だちに紐づきます。
          </p>
        </div>
      </Card>

      {/* 設定 */}
      <Card className="mb-5">
        <CardHeader title="設定" description="営業時間・枠・定員。日本時間で扱います。" />
        <form action={updateReservationPage.bind(null, id)} className="space-y-4 p-5">
          <FormField label="名前" htmlFor="title" required>
            <Input id="title" name="title" defaultValue={page.title} required />
          </FormField>
          <FormField label="説明（任意）" htmlFor="description">
            <Input id="description" name="description" defaultValue={page.description} />
          </FormField>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField label="開始(時)" htmlFor="openHour">
              <Input id="openHour" name="openHour" type="number" min={0} max={23} defaultValue={page.openHour} />
            </FormField>
            <FormField label="終了(時)" htmlFor="closeHour">
              <Input id="closeHour" name="closeHour" type="number" min={1} max={24} defaultValue={page.closeHour} />
            </FormField>
            <FormField label="枠間隔(分)" htmlFor="slotMinutes">
              <Input id="slotMinutes" name="slotMinutes" type="number" min={5} step={5} defaultValue={page.slotMinutes} />
            </FormField>
            <FormField label="定員/枠" htmlFor="capacity">
              <Input id="capacity" name="capacity" type="number" min={1} defaultValue={page.capacity} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {page.type === "simple" && (
              <FormField label="所要時間(分)" htmlFor="durationMinutes" hint="シンプル時の1枠">
                <Input id="durationMinutes" name="durationMinutes" type="number" min={5} step={5} defaultValue={page.durationMinutes} />
              </FormField>
            )}
            <FormField label="何日先まで" htmlFor="daysAhead">
              <Input id="daysAhead" name="daysAhead" type="number" min={1} defaultValue={page.daysAhead} />
            </FormField>
            <FormField label="予約時に付与するタグ" htmlFor="autoTagId">
              <Select id="autoTagId" name="autoTagId" defaultValue={page.autoTagId ?? ""}>
                <option value="">なし</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="休業曜日" htmlFor="closedWeekdays">
            <div className="flex flex-wrap gap-3">
              {WD.map((w, i) => (
                <label key={i} className="flex items-center gap-1.5 text-sm text-ink">
                  <input type="checkbox" name="closedWeekdays" value={i} defaultChecked={page.closedWeekdays.includes(i)} className="accent-[#dd2a7b]" />
                  {w}
                </label>
              ))}
            </div>
          </FormField>
          <FormField label="予約確定メッセージ（任意・{{name}}使用可）" htmlFor="confirmText" hint="空ならデフォルト文。LINEで送信されます。">
            <Textarea id="confirmText" name="confirmText" defaultValue={page.confirmText} placeholder="{{name}}様、ご予約ありがとうございます。" />
          </FormField>

          <div className="rounded-lg border border-line bg-surface-2/40 p-4">
            <p className="text-sm font-medium text-ink">予約・キャンセルの通知先（店舗側）</p>
            <p className="mt-0.5 text-xs text-muted">予約が入った時・キャンセルされた時に、下記へ通知します。</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="通知するLINEタグ" htmlFor="notifyTagId" hint="このタグを付けた友だち（オーナー/スタッフ等）へLINE通知">
                <Select id="notifyTagId" name="notifyTagId" defaultValue={page.notifyTagId ?? ""}>
                  <option value="">通知しない</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="通知先メール（任意）" htmlFor="notifyEmail" hint="メール送信設定があるとき送信">
                <Input id="notifyEmail" name="notifyEmail" type="email" defaultValue={page.notifyEmail} placeholder="owner@example.com" />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="solid" size="md">保存</Button>
          </div>
        </form>
      </Card>

      {/* メニュー（メニュー型のみ） */}
      {page.type === "menu" && (
        <Card className="mb-5">
          <CardHeader title="メニュー" description={`${menus.length}件`} />
          <div className="divide-y divide-line">
            {menus.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="ml-2 text-sm text-muted">{m.durationMinutes}分{m.price != null ? ` / ¥${m.price.toLocaleString()}` : ""}</span>
                </div>
                <form action={removeReservationMenu.bind(null, m.id, id)}>
                  <button type="submit" className="rounded p-1 text-muted hover:bg-danger-bg hover:text-danger" title="削除">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            ))}
            {menus.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">メニューがありません。下から追加してください。</p>}
          </div>
          <form action={addReservationMenu.bind(null, id)} className="flex flex-wrap items-end gap-3 border-t border-line p-5">
            <FormField label="メニュー名" htmlFor="name" required className="min-w-40 flex-1">
              <Input id="name" name="name" placeholder="カット" required />
            </FormField>
            <FormField label="所要時間(分)" htmlFor="mDuration">
              <Input id="mDuration" name="durationMinutes" type="number" min={5} step={5} defaultValue={60} />
            </FormField>
            <FormField label="料金(円・任意)" htmlFor="price">
              <Input id="price" name="price" type="number" min={0} placeholder="4000" />
            </FormField>
            <Button type="submit" variant="outline" size="md">
              <Plus className="size-4" />
              追加
            </Button>
          </form>
        </Card>
      )}

      {/* オプションメニュー（メニュー型のみ） */}
      {page.type === "menu" && (
        <Card className="mb-5">
          <CardHeader title="オプションメニュー" description="基本メニューに追加で選べる項目（所要時間・料金は基本に加算）。" />
          <div className="divide-y divide-line">
            {options.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <span className="font-medium text-ink">{o.name}</span>
                  <span className="ml-2 text-sm text-muted">
                    +{o.durationMinutes}分{o.price != null ? ` / +¥${o.price.toLocaleString()}` : ""}
                  </span>
                </div>
                <form action={removeReservationMenu.bind(null, o.id, id)}>
                  <button type="submit" className="rounded p-1 text-muted hover:bg-danger-bg hover:text-danger" title="削除">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            ))}
            {options.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">オプションはありません。基本メニューに加えたい項目を下から追加できます。</p>}
          </div>
          <form action={addReservationOption.bind(null, id)} className="flex flex-wrap items-end gap-3 border-t border-line p-5">
            <FormField label="オプション名" htmlFor="oName" required className="min-w-40 flex-1">
              <Input id="oName" name="name" placeholder="シャンプー" required />
            </FormField>
            <FormField label="追加時間(分)" htmlFor="oDuration" hint="0でも可">
              <Input id="oDuration" name="durationMinutes" type="number" min={0} step={5} defaultValue={15} />
            </FormField>
            <FormField label="追加料金(円・任意)" htmlFor="oPrice">
              <Input id="oPrice" name="price" type="number" min={0} placeholder="1000" />
            </FormField>
            <Button type="submit" variant="outline" size="md">
              <Plus className="size-4" />
              追加
            </Button>
          </form>
        </Card>
      )}

      {/* 予約表 */}
      <Card className="mb-5">
        <CardHeader title="予約一覧" description={`${rows.length}件`} />
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">まだ予約がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-2.5">日時</th>
                  <th className="px-5 py-2.5">顧客</th>
                  {page.type === "menu" && <th className="px-5 py-2.5">メニュー</th>}
                  <th className="px-5 py-2.5">状態</th>
                  <th className="px-5 py-2.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 text-ink">{fmt(r.startAt)}</td>
                    <td className="px-5 py-3 text-ink">
                      {r.friendName}
                      {r.phone && <span className="ml-1 text-xs text-muted">({r.phone})</span>}
                    </td>
                    {page.type === "menu" && (
                      <td className="px-5 py-3 text-muted">
                        {r.menuName ?? "—"}
                        {r.optionNames.length > 0 && (
                          <span className="block text-xs text-faint">＋{r.optionNames.join("、")}</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {r.status === "confirmed" ? (
                        <div className="flex gap-1.5">
                          <form action={setReservationStatus.bind(null, r.id, id, "done")}>
                            <button type="submit" className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-surface-2">来店済</button>
                          </form>
                          <form action={setReservationStatus.bind(null, r.id, id, "noshow")}>
                            <button type="submit" className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-surface-2">来店なし</button>
                          </form>
                          <form action={setReservationStatus.bind(null, r.id, id, "cancelled")}>
                            <button type="submit" className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger-bg">取消</button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 削除 */}
      <Card>
        <CardHeader title="削除" description="この予約ページとメニュー・予約を削除します。" />
        <div className="p-5">
          <form action={deleteReservationPage.bind(null, id)}>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg">
              <Trash2 className="size-4" />
              この予約ページを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
