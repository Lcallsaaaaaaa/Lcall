"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import type { Reservation, ReservationType } from "@/lib/data/types";
import { isRealToken, pushText } from "@/lib/line";
import { publicBaseUrl } from "@/lib/url";
import { applyNameVars } from "@/lib/vars";
import { notifyReservation } from "./notify";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function num(v: FormDataEntryValue | null, fallback: number): number {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : fallback;
}
function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function requireOwner() {
  const session = await getSession();
  if (!session || session.role !== "owner") throw new Error("forbidden");
}

const fmtJa = (iso: string) => {
  const d = new Date(iso);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ---- 管理：予約ページ ----

export async function createReservationPage(formData: FormData) {
  await requireOwner();
  const db = getDataProvider();
  const type: ReservationType = str(formData.get("type")) === "menu" ? "menu" : "simple";
  const id = uid("rp");
  await db.reservationPages.create({
    id,
    title: str(formData.get("title")) || "予約",
    type,
    lineAccountId: str(formData.get("lineAccountId")) || undefined,
    description: str(formData.get("description")) || undefined,
    slotMinutes: num(formData.get("slotMinutes"), 30),
    durationMinutes: num(formData.get("durationMinutes"), 30),
    capacity: Math.max(1, num(formData.get("capacity"), 1)),
    openHour: num(formData.get("openHour"), 10),
    closeHour: num(formData.get("closeHour"), 19),
    closedWeekdays: formData.getAll("closedWeekdays").map((v) => Number(v)).filter((n) => n >= 0 && n <= 6),
    daysAhead: Math.max(1, num(formData.get("daysAhead"), 30)),
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/reservations");
  redirect(`/reservations/${id}`);
}

export async function updateReservationPage(id: string, formData: FormData) {
  await requireOwner();
  const db = getDataProvider();
  await db.reservationPages.update(id, {
    title: str(formData.get("title")) || "予約",
    lineAccountId: str(formData.get("lineAccountId")) || undefined,
    description: str(formData.get("description")) || undefined,
    slotMinutes: num(formData.get("slotMinutes"), 30),
    durationMinutes: num(formData.get("durationMinutes"), 30),
    capacity: Math.max(1, num(formData.get("capacity"), 1)),
    openHour: num(formData.get("openHour"), 10),
    closeHour: num(formData.get("closeHour"), 19),
    closedWeekdays: formData.getAll("closedWeekdays").map((v) => Number(v)).filter((n) => n >= 0 && n <= 6),
    daysAhead: Math.max(1, num(formData.get("daysAhead"), 30)),
    autoTagId: str(formData.get("autoTagId")) || undefined,
    confirmText: str(formData.get("confirmText")) || undefined,
    joinText: str(formData.get("joinText")) || undefined,
    notifyEmail: str(formData.get("notifyEmail")) || undefined,
    notifyTagId: str(formData.get("notifyTagId")) || undefined,
  });
  revalidatePath(`/reservations/${id}`);
}

export async function deleteReservationPage(id: string) {
  await requireOwner();
  const db = getDataProvider();
  const [menus, reservations] = await Promise.all([
    db.reservationMenus.list(),
    db.reservations.list(),
  ]);
  await Promise.all(menus.filter((m) => m.reservationPageId === id).map((m) => db.reservationMenus.remove(m.id)));
  await Promise.all(reservations.filter((r) => r.reservationPageId === id).map((r) => db.reservations.remove(r.id)));
  await db.reservationPages.remove(id);
  revalidatePath("/reservations");
  redirect("/reservations");
}

export async function addReservationMenu(pageId: string, formData: FormData) {
  await requireOwner();
  const db = getDataProvider();
  const existing = (await db.reservationMenus.list()).filter(
    (m) => m.reservationPageId === pageId && m.kind !== "option"
  );
  await db.reservationMenus.create({
    id: uid("rm"),
    reservationPageId: pageId,
    name: str(formData.get("name")) || "メニュー",
    durationMinutes: Math.max(5, num(formData.get("durationMinutes"), 60)),
    price: str(formData.get("price")) ? num(formData.get("price"), 0) : undefined,
    order: existing.length,
    kind: "menu",
  });
  revalidatePath(`/reservations/${pageId}`);
}

export async function addReservationOption(pageId: string, formData: FormData) {
  await requireOwner();
  const db = getDataProvider();
  const existing = (await db.reservationMenus.list()).filter(
    (m) => m.reservationPageId === pageId && m.kind === "option"
  );
  await db.reservationMenus.create({
    id: uid("ro"),
    reservationPageId: pageId,
    name: str(formData.get("name")) || "オプション",
    durationMinutes: Math.max(0, num(formData.get("durationMinutes"), 0)),
    price: str(formData.get("price")) ? num(formData.get("price"), 0) : undefined,
    order: existing.length,
    kind: "option",
  });
  revalidatePath(`/reservations/${pageId}`);
}

export async function removeReservationMenu(menuId: string, pageId: string) {
  await requireOwner();
  await getDataProvider().reservationMenus.remove(menuId);
  revalidatePath(`/reservations/${pageId}`);
}

export async function setReservationStatus(
  reservationId: string,
  pageId: string,
  status: Reservation["status"]
) {
  await requireOwner();
  await getDataProvider().reservations.update(reservationId, { status });
  revalidatePath(`/reservations/${pageId}`);
}

// ---- 公開：予約する（認証不要・公開予約ページから） ----

export async function createReservation(pageId: string, formData: FormData) {
  const db = getDataProvider();
  const page = await db.reservationPages.get(pageId);
  if (!page) redirect(`/yoyaku/${pageId}`);

  const startISO = str(formData.get("startISO"));
  const start = new Date(startISO);
  if (!startISO || Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    redirect(`/yoyaku/${pageId}?error=slot`);
  }
  const friendId = str(formData.get("u")) || undefined;
  const friend = friendId ? await db.friends.get(friendId) : null;
  const menuId = page.type === "menu" ? str(formData.get("menuId")) || undefined : undefined;
  const menu = menuId ? await db.reservationMenus.get(menuId) : null;
  if (page.type === "menu" && (!menu || menu.kind === "option")) redirect(`/yoyaku/${pageId}?error=menu`);

  // 追加オプション（このページの kind=option のみ採用）
  const optionIds = formData.getAll("optionIds").map(String).filter(Boolean);
  const allMenus = await db.reservationMenus.list();
  const options = allMenus.filter(
    (m) => m.reservationPageId === pageId && m.kind === "option" && optionIds.includes(m.id)
  );

  const durationMin =
    (menu?.durationMinutes ?? page.durationMinutes) +
    options.reduce((s, o) => s + o.durationMinutes, 0);
  const endMs = start.getTime() + durationMin * 60000;

  // 定員の最終チェック（二重予約・満枠を防ぐ）
  const overlap = (await db.reservations.list()).filter(
    (r) =>
      r.reservationPageId === pageId &&
      r.status === "confirmed" &&
      new Date(r.startAt).getTime() < endMs &&
      start.getTime() < new Date(r.endAt).getTime()
  ).length;
  if (overlap >= page.capacity) redirect(`/yoyaku/${pageId}?error=full`);

  const id = uid("rv");
  const cancelToken = Math.random().toString(36).slice(2, 12);
  await db.reservations.create({
    id,
    reservationPageId: pageId,
    friendId,
    menuId,
    lineAccountId: friend?.lineAccountId ?? page.lineAccountId,
    startAt: start.toISOString(),
    endAt: new Date(endMs).toISOString(),
    status: "confirmed",
    optionIds: options.length ? options.map((o) => o.id) : undefined,
    name: str(formData.get("name")) || undefined,
    phone: str(formData.get("phone")) || undefined,
    note: str(formData.get("note")) || undefined,
    cancelToken,
    createdAt: new Date().toISOString(),
  });

  // 回答時タグ付与（予約時タグ）
  if (page.autoTagId && friendId) {
    const tags = await db.friendTags.list();
    if (!tags.some((t) => t.friendId === friendId && t.tagId === page.autoTagId)) {
      await db.friendTags.create({
        id: uid("ft"),
        friendId,
        tagId: page.autoTagId,
        auto: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 取消リンク（本人セルフキャンセル用）。公開URL基底はリクエストから導出。
  const base = await publicBaseUrl();
  const cancelUrl = base ? `${base}/yoyaku/${pageId}/cancel?r=${id}&t=${cancelToken}` : "";

  // LINE 予約確定メッセージ（実トークン時のみ送信）
  if (friend) {
    const account = await db.lineAccounts.get(friend.lineAccountId);
    if (account && isRealToken(account.channelAccessToken)) {
      const head = page.confirmText
        ? applyNameVars(page.confirmText, friend.displayName)
        : `ご予約を承りました。`;
      const lines = [head, `日時：${fmtJa(start.toISOString())}`];
      if (menu) lines.push(`メニュー：${menu.name}`);
      if (options.length) lines.push(`オプション：${options.map((o) => o.name).join("、")}`);
      if (cancelUrl) lines.push(`\nご予約の確認・キャンセルはこちら：\n${cancelUrl}`);
      await pushText(account.channelAccessToken, friend.lineUserId, lines.join("\n"));
    }
  }

  // 店舗側へ通知（指定タグの友だちへLINE＋指定メール）
  const created = await db.reservations.get(id);
  if (created) await notifyReservation(db, created, "created");

  revalidatePath(`/reservations/${pageId}`);
  // 友だちでない予約者には「友だち追加でリマインドが届く」案内を表示（join=1）
  redirect(`/yoyaku/${pageId}?submitted=1${friend ? "" : "&join=1"}`);
}

/** 公開：本人によるキャンセル（取消トークン必須・認証不要）。 */
export async function cancelReservationPublic(pageId: string, formData: FormData) {
  const db = getDataProvider();
  const rid = str(formData.get("r"));
  const token = str(formData.get("t"));
  const r = rid ? await db.reservations.get(rid) : null;
  // トークン不一致・別ページ・予約なしは無効（成功画面には遷移させない）
  if (!r || r.reservationPageId !== pageId || !r.cancelToken || r.cancelToken !== token) {
    redirect(`/yoyaku/${pageId}/cancel?r=${rid}&t=${token}&error=invalid`);
  }
  if (r.status === "confirmed") {
    await db.reservations.update(r.id, { status: "cancelled" });
    const updated = await db.reservations.get(r.id);
    if (updated) await notifyReservation(db, updated, "cancelled");
    revalidatePath(`/reservations/${pageId}`);
  }
  redirect(`/yoyaku/${pageId}/cancel?r=${rid}&t=${token}&done=1`);
}
