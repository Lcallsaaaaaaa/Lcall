"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import type { BroadcastType, CarouselCard, RedirectLink } from "@/lib/data/types";
import { saveImageBytes } from "@/lib/storage";
import { deliverBroadcast } from "./deliver";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * カード画像を解決する。優先順位: アップロード > 保管から選択 > URL直接入力。
 * アップロード時は保存してメディアライブラリにも登録（再利用できるように）。
 */
async function resolveCardImage(formData: FormData): Promise<string> {
  const file = formData.get("imageFile");
  if (
    file instanceof File &&
    file.size > 0 &&
    file.type.startsWith("image/") &&
    file.size <= MAX_IMAGE_BYTES
  ) {
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await saveImageBytes(buf, file.type);
    await getDataProvider().mediaAssets.create({
      id: uid("med"),
      name: file.name || "カルーセル画像",
      url,
      createdAt: new Date().toISOString(),
    });
    return url;
  }
  const selected = str(formData.get("imageUrlSelect"));
  if (selected) return selected;
  return str(formData.get("imageUrl"));
}

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function bool(v: FormDataEntryValue | null): boolean {
  return v != null && (v === "on" || v === "true" || v === "1");
}
function parseType(v: FormDataEntryValue | null): BroadcastType {
  const s = String(v ?? "");
  return s === "text" || s === "carousel" || s === "url" ? s : "text";
}
function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function newTrackingId(): string {
  return `trk_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function revalidate(id?: string) {
  revalidatePath("/broadcasts");
  revalidatePath("/carousel");
  revalidatePath("/inbox"); // チャットのカルーセル選択・カード数に反映
  revalidatePath("/");
  if (id) {
    revalidatePath(`/broadcasts/${id}`);
    revalidatePath(`/carousel/${id}`); // カルーセル専用編集ページ
  }
}

export async function createBroadcast(formData: FormData) {
  const db = getDataProvider();
  const type = parseType(formData.get("type"));
  const id = uid("bc");
  const now = new Date().toISOString();

  await db.broadcasts.create({
    id,
    title: str(formData.get("title")) || "無題の配信",
    type,
    status: "draft",
    text: type === "carousel" ? undefined : str(formData.get("text")) || undefined,
    targetTagIds: formData.getAll("targetTagIds").map(String),
    lineAccountId: str(formData.get("lineAccountId")) || undefined,
    sentCount: 0,
    createdAt: now,
  });

  if (type === "url") {
    const targetUrl = str(formData.get("targetUrl"));
    if (targetUrl) {
      await db.redirectLinks.create({
        id: uid("rl"),
        trackingId: newTrackingId(),
        targetUrl,
        openExternalBrowser: bool(formData.get("openExternalBrowser")),
        autoTagId: str(formData.get("autoTagId")) || undefined,
        adCode: str(formData.get("adCode")) || undefined,
        broadcastId: id,
        createdAt: now,
      });
    }
  }

  redirect(`/broadcasts/${id}`);
}

/** カルーセルを新規作成（下書き）。カードは詳細画面で追加。配信設定（送信/予約）は明示操作のみ。 */
export async function createCarousel(formData: FormData) {
  const db = getDataProvider();
  const id = uid("bc");
  await db.broadcasts.create({
    id,
    title: str(formData.get("title")) || "無題のカルーセル",
    type: "carousel",
    status: "draft",
    targetTagIds: [],
    sentCount: 0,
    createdAt: new Date().toISOString(),
  });
  revalidate(id);
  redirect(`/carousel/${id}`);
}

/** カルーセル名（管理用タイトル）のみ更新。カルーセル専用ページから使用。 */
export async function updateCarouselTitle(id: string, formData: FormData) {
  await getDataProvider().broadcasts.update(id, {
    title: str(formData.get("title")) || "無題のカルーセル",
  });
  revalidate(id);
  redirect(`/carousel/${id}`);
}

/** カルーセルと関連カード・計測リンクを削除し、カルーセル一覧へ戻る。 */
export async function deleteCarousel(id: string) {
  const db = getDataProvider();
  const [cards, links, targets] = await Promise.all([
    db.carouselCards.list(),
    db.redirectLinks.list(),
    db.broadcastTargets.list(),
  ]);
  await Promise.all([
    ...cards.filter((c) => c.broadcastId === id).map((c) => db.carouselCards.remove(c.id)),
    ...links.filter((l) => l.broadcastId === id).map((l) => db.redirectLinks.remove(l.id)),
    ...targets.filter((t) => t.broadcastId === id).map((t) => db.broadcastTargets.remove(t.id)),
  ]);
  await db.broadcasts.remove(id);
  revalidate();
  redirect("/carousel");
}

export async function updateBroadcast(id: string, formData: FormData) {
  const db = getDataProvider();
  const b = await db.broadcasts.get(id);
  if (!b) redirect("/broadcasts");

  await db.broadcasts.update(id, {
    title: str(formData.get("title")) || "無題の配信",
    text: b.type === "carousel" ? undefined : str(formData.get("text")) || undefined,
    targetTagIds: formData.getAll("targetTagIds").map(String),
    lineAccountId: str(formData.get("lineAccountId")) || undefined,
  });

  if (b.type === "url") {
    const links = await db.redirectLinks.list();
    const link = links.find((l) => l.broadcastId === id);
    const patch = {
      targetUrl: str(formData.get("targetUrl")),
      openExternalBrowser: bool(formData.get("openExternalBrowser")),
      autoTagId: str(formData.get("autoTagId")) || undefined,
      adCode: str(formData.get("adCode")) || undefined,
    };
    if (link) await db.redirectLinks.update(link.id, patch);
    else if (patch.targetUrl)
      await db.redirectLinks.create({
        id: uid("rl"),
        trackingId: newTrackingId(),
        broadcastId: id,
        createdAt: new Date().toISOString(),
        ...patch,
      });
  }

  revalidate(id);
  redirect(`/broadcasts/${id}`);
}

export async function deleteBroadcast(id: string) {
  const db = getDataProvider();
  const [cards, links, targets] = await Promise.all([
    db.carouselCards.list(),
    db.redirectLinks.list(),
    db.broadcastTargets.list(),
  ]);
  await Promise.all([
    ...cards.filter((c) => c.broadcastId === id).map((c) => db.carouselCards.remove(c.id)),
    ...links.filter((l) => l.broadcastId === id).map((l) => db.redirectLinks.remove(l.id)),
    ...targets.filter((t) => t.broadcastId === id).map((t) => db.broadcastTargets.remove(t.id)),
  ]);
  await db.broadcasts.remove(id);
  revalidate();
  redirect("/broadcasts");
}

/** 今すぐ送信（対象解決＋記録、実トークン時は実LINE push）。 */
export async function sendBroadcast(id: string) {
  await deliverBroadcast(getDataProvider(), id);
  revalidate(id);
}

export async function scheduleBroadcast(id: string, formData: FormData) {
  const at = str(formData.get("scheduledAt"));
  await getDataProvider().broadcasts.update(id, {
    status: "scheduled",
    scheduledAt: at ? new Date(at).toISOString() : undefined,
  });
  revalidate(id);
}

export async function addCarouselCard(broadcastId: string, formData: FormData) {
  const db = getDataProvider();
  const cards = (await db.carouselCards.list()).filter((c) => c.broadcastId === broadcastId);
  const linkId = uid("rl");
  const oeb = bool(formData.get("openExternalBrowser"));
  const now = new Date().toISOString();
  const imageUrl = await resolveCardImage(formData);

  await db.redirectLinks.create({
    id: linkId,
    trackingId: newTrackingId(),
    targetUrl: str(formData.get("targetUrl")),
    openExternalBrowser: oeb,
    autoTagId: str(formData.get("autoTagId")) || undefined,
    adCode: str(formData.get("adCode")) || undefined,
    broadcastId,
    createdAt: now,
  });
  await db.carouselCards.create({
    id: uid("cc"),
    broadcastId,
    order: cards.length,
    title: str(formData.get("title")),
    description: str(formData.get("description")),
    imageUrl,
    buttonLabel: str(formData.get("buttonLabel")) || "詳しく見る",
    redirectLinkId: linkId,
    openExternalBrowser: oeb,
  });

  revalidate(broadcastId);
}

export async function updateCarouselCard(cardId: string, broadcastId: string, formData: FormData) {
  const db = getDataProvider();
  const card = await db.carouselCards.get(cardId);
  if (!card) {
    revalidate(broadcastId);
    return;
  }
  const oeb = bool(formData.get("openExternalBrowser"));
  const img = await resolveCardImage(formData); // 新規指定が無ければ "" → 既存画像を維持
  await db.carouselCards.update(cardId, {
    title: str(formData.get("title")),
    description: str(formData.get("description")),
    buttonLabel: str(formData.get("buttonLabel")) || "詳しく見る",
    imageUrl: img || card.imageUrl,
    openExternalBrowser: oeb,
  });
  await db.redirectLinks.update(card.redirectLinkId, {
    targetUrl: str(formData.get("targetUrl")),
    autoTagId: str(formData.get("autoTagId")) || undefined,
    adCode: str(formData.get("adCode")) || undefined,
    openExternalBrowser: oeb,
  });
  revalidate(broadcastId);
}

export async function removeCarouselCard(cardId: string, broadcastId: string) {
  const db = getDataProvider();
  const card = await db.carouselCards.get(cardId);
  if (card) {
    await db.carouselCards.remove(cardId);
    await db.redirectLinks.remove(card.redirectLinkId);
  }
  revalidate(broadcastId);
}

export async function saveAsTemplate(id: string) {
  const db = getDataProvider();
  const b = await db.broadcasts.get(id);
  if (!b) return;

  let cardsJson: string | undefined;
  if (b.type === "carousel") {
    const [cards, links] = await Promise.all([db.carouselCards.list(), db.redirectLinks.list()]);
    const linkById = new Map(links.map((l) => [l.id, l]));
    const snapshot = cards
      .filter((c) => c.broadcastId === id)
      .sort((a, b2) => a.order - b2.order)
      .map((c) => {
        const link = linkById.get(c.redirectLinkId);
        return {
          title: c.title,
          description: c.description,
          imageUrl: c.imageUrl,
          buttonLabel: c.buttonLabel,
          targetUrl: link?.targetUrl ?? "",
          autoTagId: link?.autoTagId ?? null,
          openExternalBrowser: c.openExternalBrowser,
        };
      });
    cardsJson = JSON.stringify(snapshot);
  }

  await db.broadcastTemplates.create({
    id: uid("tpl"),
    name: b.title,
    type: b.type,
    text: b.text,
    targetTagIds: b.targetTagIds,
    cardsJson,
    createdAt: new Date().toISOString(),
  });
  revalidate();
}

export async function createFromTemplate(templateId: string) {
  const db = getDataProvider();
  const tpl = await db.broadcastTemplates.get(templateId);
  if (!tpl) redirect("/broadcasts");

  const id = uid("bc");
  const now = new Date().toISOString();
  await db.broadcasts.create({
    id,
    title: `${tpl.name}（コピー）`,
    type: tpl.type,
    status: "draft",
    text: tpl.text,
    targetTagIds: tpl.targetTagIds,
    sentCount: 0,
    createdAt: now,
  });

  if (tpl.type === "carousel" && tpl.cardsJson) {
    const snapshot = JSON.parse(tpl.cardsJson) as Array<
      Pick<CarouselCard, "title" | "description" | "imageUrl" | "buttonLabel" | "openExternalBrowser"> & {
        targetUrl: string;
        autoTagId: string | null;
      }
    >;
    let order = 0;
    for (const s of snapshot) {
      const linkId = uid("rl");
      await db.redirectLinks.create({
        id: linkId,
        trackingId: newTrackingId(),
        targetUrl: s.targetUrl,
        openExternalBrowser: s.openExternalBrowser,
        autoTagId: s.autoTagId ?? undefined,
        broadcastId: id,
        createdAt: now,
      } satisfies RedirectLink);
      await db.carouselCards.create({
        id: uid("cc"),
        broadcastId: id,
        order: order++,
        title: s.title,
        description: s.description,
        imageUrl: s.imageUrl,
        buttonLabel: s.buttonLabel,
        redirectLinkId: linkId,
        openExternalBrowser: s.openExternalBrowser,
      });
    }
  }

  redirect(`/broadcasts/${id}`);
}
