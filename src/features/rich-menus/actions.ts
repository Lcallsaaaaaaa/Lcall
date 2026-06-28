"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  RICH_MENU_CANVAS,
  cellCount,
  getTemplate,
  templateCells,
} from "@/config/rich-menu-templates";
import { getDataProvider } from "@/lib/data/provider";
import { requireNav } from "@/lib/guard";
import {
  clearDefaultRichMenu,
  createRichMenu as lineCreateRichMenu,
  deleteRichMenu as lineDeleteRichMenu,
  isRealToken,
  linkRichMenuBulk,
  setDefaultRichMenu,
  uploadRichMenuImage,
} from "@/lib/line";
import { readImageBytes, saveImageBytes } from "@/lib/storage";
import type { RichMenu, RichMenuArea, RichMenuActionType, RichMenuSize } from "@/lib/data/types";

const MAX_IMAGE_BYTES = 1024 * 1024; // LINEのリッチメニュー画像は最大1MB

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}

function parseAction(v: FormDataEntryValue | null): RichMenuActionType {
  const s = String(v ?? "none");
  return s === "uri" || s === "message" ? s : "none";
}

/** scope(default|tag)+tag から isDefault/targetTagId を決める。 */
function scopeFields(formData: FormData): { isDefault: boolean; targetTagId?: string } {
  const scope = str(formData.get("scope"));
  const tag = str(formData.get("targetTagId"));
  if (scope === "tag" && tag) return { isDefault: false, targetTagId: tag };
  return { isDefault: true, targetTagId: undefined };
}

function revalidate(id?: string) {
  revalidatePath("/rich-menus");
  if (id) revalidatePath(`/rich-menus/${id}/edit`);
}

/** 新規作成（ドラフト）。テンプレートからセル数分の空アクションを用意して編集へ。 */
export async function createRichMenu(formData: FormData) {
  await requireNav("rich-menus");
  const template = str(formData.get("template")) || "large-2x3";
  const t = getTemplate(template);
  const size: RichMenuSize = t?.size ?? "large";
  const n = cellCount(template);
  const areas: RichMenuArea[] = Array.from({ length: n }, () => ({ action: "none" as RichMenuActionType }));
  const { isDefault, targetTagId } = scopeFields(formData);

  const menu: RichMenu = {
    id: `rm_${Date.now()}`,
    name: str(formData.get("name")) || "リッチメニュー",
    lineAccountId: str(formData.get("lineAccountId")),
    size,
    template,
    chatBarText: str(formData.get("chatBarText")) || "メニュー",
    areas,
    isDefault,
    targetTagId,
    createdAt: new Date().toISOString(),
  };
  await getDataProvider().richMenus.create(menu);
  revalidate(menu.id);
  redirect(`/rich-menus/${menu.id}/edit?ok=created`);
}

/** 基本情報（名称・メニューバー文言・反映先）の更新。 */
export async function updateRichMenuBasics(id: string, formData: FormData) {
  await requireNav("rich-menus");
  const { isDefault, targetTagId } = scopeFields(formData);
  await getDataProvider().richMenus.update(id, {
    name: str(formData.get("name")) || "リッチメニュー",
    chatBarText: str(formData.get("chatBarText")) || "メニュー",
    isDefault,
    targetTagId,
  });
  revalidate(id);
  redirect(`/rich-menus/${id}/edit?ok=saved`);
}

/** 各ボタン（タップ領域）のアクションを更新。 */
export async function updateRichMenuAreas(id: string, formData: FormData) {
  await requireNav("rich-menus");
  const db = getDataProvider();
  const menu = await db.richMenus.get(id);
  if (!menu) redirect("/rich-menus");
  const n = cellCount(menu.template);
  const areas: RichMenuArea[] = [];
  for (let i = 0; i < n; i++) {
    areas.push({
      action: parseAction(formData.get(`action_${i}`)),
      label: str(formData.get(`label_${i}`)) || undefined,
      uri: str(formData.get(`uri_${i}`)) || undefined,
      text: str(formData.get(`text_${i}`)) || undefined,
    });
  }
  await db.richMenus.update(id, { areas });
  revalidate(id);
  redirect(`/rich-menus/${id}/edit?ok=areas`);
}

/** メニュー画像のアップロード（保管して公開URLを保存）。 */
export async function uploadRichMenuImageAction(id: string, formData: FormData) {
  await requireNav("rich-menus");
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/rich-menus/${id}/edit?error=nofile`);
  }
  const f = file as File;
  if (!f.type.startsWith("image/")) redirect(`/rich-menus/${id}/edit?error=type`);
  if (f.size > MAX_IMAGE_BYTES) redirect(`/rich-menus/${id}/edit?error=imagesize`);
  const buf = Buffer.from(await f.arrayBuffer());
  const url = await saveImageBytes(buf, f.type);
  await getDataProvider().richMenus.update(id, { imageUrl: url });
  revalidate(id);
  redirect(`/rich-menus/${id}/edit?ok=image`);
}

/** 実LINEへ反映＝作成→画像アップロード→既定設定 or タグ別リンク。 */
export async function applyRichMenu(id: string) {
  await requireNav("rich-menus");
  const db = getDataProvider();
  const menu = await db.richMenus.get(id);
  if (!menu) redirect("/rich-menus");
  const account = await db.lineAccounts.get(menu.lineAccountId);
  const token = account?.channelAccessToken;
  if (!account || !isRealToken(token)) redirect(`/rich-menus/${id}/edit?error=demo`);
  if (!menu.imageUrl) redirect(`/rich-menus/${id}/edit?error=noimage`);

  const t = getTemplate(menu.template);
  if (!t) redirect(`/rich-menus/${id}/edit?error=template`);
  const cells = templateCells(t);
  const areas = menu.areas
    .map((a, i) => ({ a, cell: cells[i] }))
    .filter(({ a, cell }) => cell && a.action !== "none" && (a.uri || a.text))
    .map(({ a, cell }) => {
      const label = (a.label || "").slice(0, 20) || undefined;
      const action =
        a.action === "uri"
          ? { type: "uri", label, uri: a.uri }
          : { type: "message", label, text: (a.text || "").slice(0, 300) };
      return { bounds: cell, action };
    });
  if (areas.length === 0) redirect(`/rich-menus/${id}/edit?error=noarea`);

  const img = await readImageBytes(menu.imageUrl);
  if (!img) redirect(`/rich-menus/${id}/edit?error=imageread`);

  // 既存の反映があれば作り直し（旧メニューを削除）
  if (menu.lineRichMenuId) await lineDeleteRichMenu(token!, menu.lineRichMenuId);

  const created = await lineCreateRichMenu(token!, {
    size: RICH_MENU_CANVAS[menu.size],
    selected: false,
    name: menu.name.slice(0, 300),
    chatBarText: (menu.chatBarText || "メニュー").slice(0, 14),
    areas,
  });
  if (!created.ok || !created.richMenuId) {
    redirect(`/rich-menus/${id}/edit?error=create`);
  }
  const richMenuId = created.richMenuId!;

  const up = await uploadRichMenuImage(token!, richMenuId, img.buffer, img.contentType);
  if (!up.ok) {
    await lineDeleteRichMenu(token!, richMenuId);
    redirect(`/rich-menus/${id}/edit?error=upload`);
  }

  if (menu.isDefault) {
    await setDefaultRichMenu(token!, richMenuId);
  } else if (menu.targetTagId) {
    const fts = (await db.friendTags.list()).filter((ft) => ft.tagId === menu.targetTagId);
    const ids = new Set(fts.map((ft) => ft.friendId));
    const friends = (await db.friends.list()).filter((f) => ids.has(f.id) && f.status === "active");
    const userIds = friends.map((f) => f.lineUserId).filter(Boolean);
    for (let i = 0; i < userIds.length; i += 500) {
      await linkRichMenuBulk(token!, richMenuId, userIds.slice(i, i + 500));
    }
  }

  await db.richMenus.update(id, { lineRichMenuId: richMenuId, appliedAt: new Date().toISOString() });
  revalidate(id);
  redirect(`/rich-menus/${id}/edit?ok=applied`);
}

/** 反映解除＝LINE上のメニュー削除＋既定解除。 */
export async function unapplyRichMenu(id: string) {
  await requireNav("rich-menus");
  const db = getDataProvider();
  const menu = await db.richMenus.get(id);
  if (!menu) redirect("/rich-menus");
  const account = await db.lineAccounts.get(menu.lineAccountId);
  const token = account?.channelAccessToken;
  if (menu.lineRichMenuId && isRealToken(token)) {
    if (menu.isDefault) await clearDefaultRichMenu(token!);
    await lineDeleteRichMenu(token!, menu.lineRichMenuId);
  }
  await db.richMenus.update(id, { lineRichMenuId: undefined, appliedAt: undefined });
  revalidate(id);
  redirect(`/rich-menus/${id}/edit?ok=unapplied`);
}

/** 削除（反映済みならLINE側も削除を試みる）。 */
export async function deleteRichMenu(id: string) {
  await requireNav("rich-menus");
  const db = getDataProvider();
  const menu = await db.richMenus.get(id);
  if (menu?.lineRichMenuId) {
    const account = await db.lineAccounts.get(menu.lineAccountId);
    if (isRealToken(account?.channelAccessToken)) {
      if (menu.isDefault) await clearDefaultRichMenu(account!.channelAccessToken);
      await lineDeleteRichMenu(account!.channelAccessToken, menu.lineRichMenuId);
    }
  }
  await db.richMenus.remove(id);
  revalidate();
  redirect("/rich-menus");
}
