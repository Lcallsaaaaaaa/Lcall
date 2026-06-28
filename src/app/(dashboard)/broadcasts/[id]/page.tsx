/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, Link2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { Badge, BroadcastStatusBadge } from "@/components/ui/StatusBadge";
import { TagChip } from "@/components/ui/TagChip";
import {
  addCarouselCard,
  deleteBroadcast,
  removeCarouselCard,
  saveAsTemplate,
  scheduleBroadcast,
  sendBroadcast,
  updateBroadcast,
  updateCarouselCard,
} from "@/features/broadcasts/actions";
import { BROADCAST_TYPE_LABEL } from "@/features/broadcasts/labels";
import { getBroadcast } from "@/features/broadcasts/queries";
import { listMedia } from "@/features/media/queries";
import { listAdCodes } from "@/features/ad-codes/queries";
import { listLineAccounts } from "@/features/line-accounts/queries";
import { listTags } from "@/features/tags/queries";

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function TrackingUrlBox({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <Link2 className="size-3.5 shrink-0 text-muted" />
      <code className="truncate text-xs text-ink">{url}</code>
    </div>
  );
}

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, tags, accounts, adCodes, media] = await Promise.all([
    getBroadcast(id),
    listTags(),
    listLineAccounts(),
    listAdCodes(),
    listMedia(),
  ]);
  if (!detail) notFound();
  // カルーセルは専用の編集ページで扱う（配信設定UIは出さない）
  if (detail.broadcast.type === "carousel") redirect(`/carousel/${id}`);

  const { broadcast: b, targetTags, cards, urlLink, recipientEstimate } = detail;
  const editable = b.status === "draft" || b.status === "scheduled";

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <Link
        href={b.type === "carousel" ? "/carousel" : "/broadcasts"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {b.type === "carousel" ? "カルーセル一覧へ" : "配信一覧へ"}
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{b.title}</h1>
        <BroadcastStatusBadge status={b.status} />
        <Badge tone="neutral">{BROADCAST_TYPE_LABEL[b.type]}</Badge>
        <span className="text-sm text-muted">対象 約{recipientEstimate.toLocaleString()}人</span>
      </div>

      {/* 内容（編集 or 読み取り） */}
      {editable ? (
        <Card className="mb-5">
          <CardHeader title="内容と対象" />
          <form action={updateBroadcast.bind(null, id)} className="space-y-4 p-5">
            <FormField label="配信タイトル" htmlFor="title" required>
              <Input id="title" name="title" defaultValue={b.title} required />
            </FormField>

            {b.type !== "carousel" && (
              <FormField label="本文" htmlFor="text">
                <Textarea id="text" name="text" defaultValue={b.text} />
              </FormField>
            )}

            {b.type === "url" && (
              <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
                <FormField label="遷移先URL" htmlFor="targetUrl" required className="sm:col-span-2">
                  <Input id="targetUrl" name="targetUrl" defaultValue={urlLink?.targetUrl} placeholder="https://example.com/lp" />
                </FormField>
                <FormField label="クリック時に付与するタグ" htmlFor="autoTagId">
                  <Select id="autoTagId" name="autoTagId" defaultValue={urlLink?.autoTagId ?? ""}>
                    <option value="">なし</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="広告コード（流入元・任意）" htmlFor="adCode">
                  <Select id="adCode" name="adCode" defaultValue={urlLink?.adCode ?? ""}>
                    <option value="">なし</option>
                    {adCodes.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="openExternalBrowser"
                    defaultChecked={urlLink?.openExternalBrowser ?? true}
                    className="accent-[#dd2a7b]"
                  />
                  外部ブラウザで開く
                </label>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-ink">対象タグ（未選択で全員）</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <label
                    key={t.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      name="targetTagIds"
                      value={t.id}
                      defaultChecked={b.targetTagIds.includes(t.id)}
                      className="accent-[#dd2a7b]"
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>

            <FormField label="送信元LINEアカウント" htmlFor="lineAccountId">
              <Select id="lineAccountId" name="lineAccountId" defaultValue={b.lineAccountId ?? ""}>
                <option value="">指定しない</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="flex justify-end">
              <button type="submit" className={buttonClasses("solid", "md")}>
                保存
              </button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="mb-5">
          <CardHeader title="内容" />
          <div className="space-y-3 p-5 text-sm">
            {b.text && <p className="whitespace-pre-wrap text-ink">{b.text}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">対象タグ:</span>
              {targetTags.length ? (
                targetTags.map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)
              ) : (
                <span className="text-faint">全員</span>
              )}
            </div>
            <p className="text-muted">
              送信日時: {b.sentAt ? new Date(b.sentAt).toLocaleString("ja-JP") : "—"} · 送信数:{" "}
              {b.sentCount.toLocaleString()}
            </p>
          </div>
        </Card>
      )}

      {/* URL種別の計測URL */}
      {b.type === "url" && urlLink && (
        <Card className="mb-5">
          <CardHeader title="計測URL" description="この計測URLをメッセージに挿入します（クリックで計測・リダイレクト）" />
          <div className="space-y-2 p-5">
            <TrackingUrlBox url={urlLink.trackingUrl} />
            {urlLink.autoTagName && (
              <p className="text-xs text-muted">
                クリック時に「{urlLink.autoTagName}」タグを自動付与
              </p>
            )}
          </div>
        </Card>
      )}

      {/* カルーセルカード */}
      {b.type === "carousel" && (
        <Card className="mb-5">
          <CardHeader title="カルーセルカード" description={`${cards.length}枚 — ボタンは計測URLを経由します`} />
          <div className="divide-y divide-line">
            {cards.map((c) => (
              <div key={c.id} className="flex flex-wrap items-start gap-4 p-5">
                {c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-lg border border-line object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{c.title || "（タイトル未設定）"}</span>
                    {c.autoTagName && <Badge tone="info">{c.autoTagName}を付与</Badge>}
                    {c.openExternalBrowser && <Badge tone="neutral">外部ブラウザ</Badge>}
                  </div>
                  {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
                  <p className="mt-1 text-xs text-muted">ボタン: {c.buttonLabel}</p>
                  <div className="mt-2">
                    <TrackingUrlBox url={c.trackingUrl} />
                  </div>
                </div>
                {editable && (
                  <form action={removeCarouselCard.bind(null, c.id, id)}>
                    <button
                      type="submit"
                      className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger"
                      title="カードを削除"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                )}
                {editable && (
                  <details className="w-full">
                    <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand hover:underline">
                      <Pencil className="size-3.5" />
                      このカードを編集
                    </summary>
                    <form
                      action={updateCarouselCard.bind(null, c.id, id)}
                      className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"
                    >
                      <FormField label="タイトル" htmlFor={`t-${c.id}`}>
                        <Input id={`t-${c.id}`} name="title" defaultValue={c.title} />
                      </FormField>
                      <FormField label="ボタン文言" htmlFor={`b-${c.id}`}>
                        <Input id={`b-${c.id}`} name="buttonLabel" defaultValue={c.buttonLabel} />
                      </FormField>
                      <FormField label="説明文" htmlFor={`d-${c.id}`} className="sm:col-span-2">
                        <Input id={`d-${c.id}`} name="description" defaultValue={c.description} />
                      </FormField>
                      <FormField label="遷移先URL" htmlFor={`u-${c.id}`} className="sm:col-span-2">
                        <Input id={`u-${c.id}`} name="targetUrl" defaultValue={c.targetUrl} />
                      </FormField>
                      <FormField label="画像を変更（保管から選択）" htmlFor={`img-${c.id}`} hint="「変更しない」なら現在の画像を維持">
                        <Select id={`img-${c.id}`} name="imageUrlSelect" defaultValue="">
                          <option value="">変更しない</option>
                          {media.map((m) => (
                            <option key={m.id} value={m.url}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="または画像URL" htmlFor={`iu-${c.id}`} hint="未入力なら現在の画像を維持">
                        <Input id={`iu-${c.id}`} name="imageUrl" placeholder="https://..." />
                      </FormField>
                      <FormField label="クリック時に付与するタグ" htmlFor={`tag-${c.id}`}>
                        <Select id={`tag-${c.id}`} name="autoTagId" defaultValue={c.autoTagId ?? ""}>
                          <option value="">なし</option>
                          {tags.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="広告コード（流入元・任意）" htmlFor={`ad-${c.id}`}>
                        <Select id={`ad-${c.id}`} name="adCode" defaultValue={c.adCode ?? ""}>
                          <option value="">なし</option>
                          {adCodes.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.label}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
                        <input
                          type="checkbox"
                          name="openExternalBrowser"
                          defaultChecked={c.openExternalBrowser}
                          className="accent-[#dd2a7b]"
                        />
                        外部ブラウザで開く
                      </label>
                      <div className="flex justify-end sm:col-span-2">
                        <Button type="submit" variant="solid" size="sm">
                          変更を保存
                        </Button>
                      </div>
                    </form>
                  </details>
                )}
              </div>
            ))}
            {cards.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-muted">カードがありません。下から追加してください。</p>
            )}
          </div>

          {editable && (
            <form action={addCarouselCard.bind(null, id)} className="space-y-4 border-t border-line p-5">
              <p className="text-sm font-medium text-ink">カードを追加</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="タイトル" htmlFor="title">
                  <Input id="title" name="title" />
                </FormField>
                <FormField label="ボタン文言" htmlFor="buttonLabel">
                  <Input id="buttonLabel" name="buttonLabel" placeholder="詳しく見る" />
                </FormField>
                <FormField label="説明文" htmlFor="description" className="sm:col-span-2">
                  <Input id="description" name="description" />
                </FormField>
                <div className="space-y-3 rounded-lg bg-surface-2 p-4 sm:col-span-2">
                  <p className="text-sm font-medium text-ink">画像（任意）</p>
                  <FormField
                    label="アップロード"
                    htmlFor="imageFile"
                    hint="JPEG/PNG・5MBまで。アップロードした画像はメディアにも登録されます"
                  >
                    <input
                      id="imageFile"
                      name="imageFile"
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:bg-surface-2"
                    />
                  </FormField>
                  <FormField label="保管から選択" htmlFor="imageUrlSelect">
                    <Select id="imageUrlSelect" name="imageUrlSelect" defaultValue="">
                      <option value="">なし</option>
                      {media.map((m) => (
                        <option key={m.id} value={m.url}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="または画像URL" htmlFor="imageUrl">
                    <Input id="imageUrl" name="imageUrl" placeholder="https://..." />
                  </FormField>
                  <p className="text-xs text-faint">優先順位: アップロード &gt; 保管から選択 &gt; URL</p>
                </div>
                <FormField label="遷移先URL" htmlFor="targetUrl" required>
                  <Input id="targetUrl" name="targetUrl" placeholder="https://example.com/lp" />
                </FormField>
                <FormField label="クリック時に付与するタグ" htmlFor="autoTagId">
                  <Select id="autoTagId" name="autoTagId" defaultValue="">
                    <option value="">なし</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="広告コード（流入元・任意）" htmlFor="cardAdCode">
                  <Select id="cardAdCode" name="adCode" defaultValue="">
                    <option value="">なし</option>
                    {adCodes.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
                  <input type="checkbox" name="openExternalBrowser" defaultChecked className="accent-[#dd2a7b]" />
                  外部ブラウザで開く
                </label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="md">
                  <Plus className="size-4" />
                  カードを追加
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* 送信・予約・テンプレ */}
      <Card accentRail className="mb-5">
        <CardHeader
          title="送信"
          description="実トークンのLINEアカウントには実際に送信します（デモは記録のみ）。予約は予約時刻に定期実行（cron）で自動送信されます。"
        />
        <div className="flex flex-wrap items-end gap-4 p-5">
          {editable && (
            <form action={sendBroadcast.bind(null, id)}>
              <Button type="submit" variant="gradient" size="md">
                <Send className="size-4" />
                今すぐ送信（約{recipientEstimate.toLocaleString()}人）
              </Button>
            </form>
          )}
          {editable && (
            <form action={scheduleBroadcast.bind(null, id)} className="flex items-end gap-2">
              <div>
                <label className="mb-1.5 block text-xs text-muted">予約日時</label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  defaultValue={toLocalInput(b.scheduledAt)}
                  className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <Button type="submit" variant="outline" size="md">
                予約する
              </Button>
            </form>
          )}
          <form action={saveAsTemplate.bind(null, id)}>
            <Button type="submit" variant="ghost" size="md">
              テンプレートとして保存
            </Button>
          </form>
          {!editable && <p className="text-sm text-muted">送信済みのため編集・再送はできません。</p>}
        </div>
      </Card>

      {/* 削除 */}
      <Card>
        <CardHeader title="削除" description="この配信と関連カード・計測リンクを削除します。" />
        <div className="p-5">
          <form action={deleteBroadcast.bind(null, id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg"
            >
              <Trash2 className="size-4" />
              この配信を削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
