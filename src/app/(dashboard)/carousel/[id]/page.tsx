/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, Link2, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Form";
import { Badge, BroadcastStatusBadge } from "@/components/ui/StatusBadge";
import {
  addCarouselCard,
  deleteCarousel,
  removeCarouselCard,
  updateCarouselCard,
  updateCarouselTitle,
} from "@/features/broadcasts/actions";
import { getBroadcast } from "@/features/broadcasts/queries";
import { listMedia } from "@/features/media/queries";
import { listAdCodes } from "@/features/ad-codes/queries";
import { listTags } from "@/features/tags/queries";

function TrackingUrlBox({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <Link2 className="size-3.5 shrink-0 text-muted" />
      <code className="truncate text-xs text-ink">{url}</code>
    </div>
  );
}

export default async function CarouselEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, tags, adCodes, media] = await Promise.all([
    getBroadcast(id),
    listTags(),
    listAdCodes(),
    listMedia(),
  ]);
  if (!detail) notFound();
  // カルーセル以外の配信は配信詳細ページで扱う
  if (detail.broadcast.type !== "carousel") redirect(`/broadcasts/${id}`);

  const { broadcast: b, cards } = detail;

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <Link
        href="/carousel"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        カルーセル一覧へ
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{b.title}</h1>
        <BroadcastStatusBadge status={b.status} />
        <Badge tone="neutral">カルーセル</Badge>
        <span className="text-sm text-muted">{cards.length}枚</span>
      </div>
      <p className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted">
        <MessageSquare className="size-3.5" />
        作成したカルーセルはチャットで友だちに送信できます（カード未追加では送れません）。
      </p>

      {/* カルーセル名（管理用） */}
      <Card className="mb-5">
        <CardHeader title="カルーセル名（管理用）" description="一覧やチャットの選択肢に表示されます。" />
        <form action={updateCarouselTitle.bind(null, id)} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="名前" htmlFor="title" className="flex-1" required>
            <Input id="title" name="title" defaultValue={b.title} required />
          </FormField>
          <button type="submit" className={buttonClasses("solid", "md")}>
            名前を保存
          </button>
        </form>
      </Card>

      {/* カルーセルカード */}
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
              <form action={removeCarouselCard.bind(null, c.id, id)}>
                <button
                  type="submit"
                  className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger"
                  title="カードを削除"
                >
                  <Trash2 className="size-4" />
                </button>
              </form>
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
            </div>
          ))}
          {cards.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-muted">カードがありません。下から追加してください。</p>
          )}
        </div>

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
      </Card>

      {/* 完了 / 削除 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/carousel" className={buttonClasses("gradient", "md")}>
          カルーセル一覧へ戻る
        </Link>
        <form action={deleteCarousel.bind(null, id)}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg"
          >
            <Trash2 className="size-4" />
            このカルーセルを削除
          </button>
        </form>
      </div>
    </div>
  );
}
