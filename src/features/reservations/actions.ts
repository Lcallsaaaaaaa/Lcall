"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import type { Reservation, ReservationPage, ReservationType } from "@/lib/data/types";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { publicBaseUrl } from "@/lib/url";
import { finalizeReservationConfirmed } from "./finalize";
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

/** 変更・キャンセルの受付期限内か（開始の changeDeadlineHours 時間前まで）。 */
function withinChangeDeadline(r: Reservation, page: ReservationPage, now = Date.now()): boolean {
  const deadline = new Date(r.startAt).getTime() - (page.changeDeadlineHours ?? 0) * 3600000;
  return now <= deadline;
}

/** 支払い済みなら Stripe で全額返金する（キャンセル時）。 */
async function refundIfPaid(r: Reservation): Promise<void> {
  if (r.paymentStatus === "paid" && r.stripePaymentIntentId && stripeEnabled()) {
    const res = await stripe("POST", "/refunds", { payment_intent: r.stripePaymentIntentId });
    if (res.ok) await getDataProvider().reservations.update(r.id, { paymentStatus: "refunded" });
  }
}

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
    paymentMode: str(formData.get("paymentMode")) === "prepay" ? "prepay" : "none",
    description: str(formData.get("description")) || undefined,
    slotMinutes: num(formData.get("slotMinutes"), 30),
    durationMinutes: num(formData.get("durationMinutes"), 30),
    capacity: Math.max(1, num(formData.get("capacity"), 1)),
    openHour: num(formData.get("openHour"), 10),
    closeHour: num(formData.get("closeHour"), 19),
    closedWeekdays: formData.getAll("closedWeekdays").map((v) => Number(v)).filter((n) => n >= 0 && n <= 6),
    daysAhead: Math.max(1, num(formData.get("daysAhead"), 30)),
    changeDeadlineHours: Math.max(0, num(formData.get("changeDeadlineHours"), 0)),
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

/**
 * 予約ページを複製（設定・メニュー・オプションをコピー。予約データはコピーしない）。
 * 新店舗の公式LINE追加時に、既存のカレンダー設定を流用して素早く立ち上げる用途。
 * 複製後の詳細画面で「対象の公式アカウント」を新店舗に切り替える。
 */
export async function duplicateReservationPage(id: string) {
  await requireOwner();
  const db = getDataProvider();
  const src = await db.reservationPages.get(id);
  if (!src) redirect("/reservations");
  const newId = uid("rp");
  const now = new Date().toISOString();
  await db.reservationPages.create({ ...src, id: newId, title: `${src.title}（コピー）`, createdAt: now });
  // メニュー/オプションも複製
  const menus = (await db.reservationMenus.list()).filter((m) => m.reservationPageId === id);
  for (const m of menus) {
    await db.reservationMenus.create({ ...m, id: uid(m.kind === "option" ? "ro" : "rm"), reservationPageId: newId });
  }
  revalidatePath("/reservations");
  redirect(`/reservations/${newId}`);
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

/**
 * 管理：未紐づけ予約に既存のLINE顧客を手動で紐づける。
 * `?u=` 無しの公開URLから入った予約（誰の予約か未特定）を、店舗が顧客を選んで結びつける。
 * 紐づけ時に予約完了LINEを送る（店舗通知は予約時に済のため skip）。
 */
export async function linkReservationToFriend(
  reservationId: string,
  pageId: string,
  formData: FormData
) {
  await requireOwner();
  const db = getDataProvider();
  const friendId = str(formData.get("friendId"));
  const friend = friendId ? await db.friends.get(friendId) : null;
  if (friend) {
    await db.reservations.update(reservationId, { friendId, lineAccountId: friend.lineAccountId });
    await finalizeReservationConfirmed(db, reservationId, "created", false);
  }
  revalidatePath(`/reservations/${pageId}`);
}

export async function setReservationStatus(
  reservationId: string,
  pageId: string,
  status: Reservation["status"]
) {
  await requireOwner();
  const db = getDataProvider();
  const r = await db.reservations.get(reservationId);
  await db.reservations.update(reservationId, { status });
  // キャンセルにしたら支払い済みは自動で全額返金
  if (status === "cancelled" && r) await refundIfPaid(r);
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

  // 二重送信ガード：同じ友だちが同じ枠を既に予約済みなら「満枠」ではなく成功扱いにする
  // （枠ボタン連打で2回目に自分の予約が満枠判定され「満枠になりました」と出る問題の対策）
  if (friendId) {
    const existing = (await db.reservations.list()).find(
      (r) =>
        r.reservationPageId === pageId &&
        r.friendId === friendId &&
        (r.status === "confirmed" || r.status === "pending") &&
        new Date(r.startAt).getTime() === start.getTime()
    );
    if (existing) redirect(`/yoyaku/${pageId}?submitted=1${friend ? "" : "&join=1"}`);
  }

  // 定員の最終チェック（確定＋支払い待ち仮押さえ で満枠を防ぐ）
  const holdCutoff = Date.now() - 30 * 60 * 1000;
  const overlap = (await db.reservations.list()).filter(
    (r) =>
      r.reservationPageId === pageId &&
      (r.status === "confirmed" ||
        (r.status === "pending" && new Date(r.createdAt).getTime() >= holdCutoff)) &&
      new Date(r.startAt).getTime() < endMs &&
      start.getTime() < new Date(r.endAt).getTime()
  ).length;
  if (overlap >= page.capacity) redirect(`/yoyaku/${pageId}?error=full`);

  // 合計料金（事前支払い用）
  const priceParts = [menu?.price, ...options.map((o) => o.price)].filter(
    (p): p is number => typeof p === "number"
  );
  const amount = priceParts.reduce((s, p) => s + p, 0);
  const isPrepay = page.paymentMode === "prepay" && stripeEnabled() && amount > 0;

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
    status: isPrepay ? "pending" : "confirmed",
    paymentStatus: isPrepay ? "unpaid" : undefined,
    amount: isPrepay ? amount : undefined,
    optionIds: options.length ? options.map((o) => o.id) : undefined,
    name: str(formData.get("name")) || undefined,
    phone: str(formData.get("phone")) || undefined,
    note: str(formData.get("note")) || undefined,
    cancelToken,
    createdAt: new Date().toISOString(),
  });

  if (isPrepay) {
    // Stripe Checkout を作成して決済へ。成功は webhook(checkout.session.completed) で確定する。
    const base = (await publicBaseUrl()) || process.env.LCALL_PUBLIC_BASE_URL?.trim() || "";
    const itemName = [menu?.name, ...options.map((o) => o.name)].filter(Boolean).join(" + ") || page.title;
    const session = await stripe("POST", "/checkout/sessions", {
      mode: "payment",
      success_url: `${base}/yoyaku/${pageId}?submitted=1&paid=1${friend ? "" : "&join=1"}`,
      cancel_url: `${base}/yoyaku/${pageId}?error=payment`,
      client_reference_id: id,
      "metadata[kind]": "reservation",
      "metadata[reservationId]": id,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "jpy",
      "line_items[0][price_data][unit_amount]": amount,
      "line_items[0][price_data][product_data][name]": itemName,
    });
    if (session.ok && session.data?.url && session.data?.id) {
      await db.reservations.update(id, { stripeSessionId: String(session.data.id) });
      redirect(String(session.data.url));
    }
    // 決済セッション作成に失敗したら仮押さえを取り消してエラー表示
    await db.reservations.update(id, { status: "cancelled" });
    redirect(`/yoyaku/${pageId}?error=payment`);
  }

  // 無料予約：その場で確定処理（タグ・確定LINE・店舗通知）
  await finalizeReservationConfirmed(db, id);

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
  // 受付期限を過ぎていたら不可
  const page = await db.reservationPages.get(pageId);
  if (page && !withinChangeDeadline(r, page)) {
    redirect(`/yoyaku/${pageId}/cancel?r=${rid}&t=${token}&error=deadline`);
  }
  if (r.status === "confirmed") {
    await db.reservations.update(r.id, { status: "cancelled" });
    await refundIfPaid(r); // 支払い済みは自動で全額返金
    const updated = await db.reservations.get(r.id);
    if (updated) await notifyReservation(db, updated, "cancelled");
    revalidatePath(`/reservations/${pageId}`);
  }
  redirect(`/yoyaku/${pageId}/cancel?r=${rid}&t=${token}&done=1`);
}

/** 公開：本人による日時変更（リスケ）。トークン必須・受付期限内のみ。 */
export async function rescheduleReservation(pageId: string, formData: FormData) {
  const db = getDataProvider();
  const rid = str(formData.get("r"));
  const token = str(formData.get("t"));
  const startISO = str(formData.get("startISO"));
  const r = rid ? await db.reservations.get(rid) : null;
  const page = await db.reservationPages.get(pageId);
  if (!r || !page || r.reservationPageId !== pageId || !r.cancelToken || r.cancelToken !== token) {
    redirect(`/yoyaku/${pageId}/change?r=${rid}&t=${token}&error=invalid`);
  }
  if (r.status !== "confirmed" || !withinChangeDeadline(r, page)) {
    redirect(`/yoyaku/${pageId}/change?r=${rid}&t=${token}&error=deadline`);
  }
  const start = new Date(startISO);
  if (!startISO || Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    redirect(`/yoyaku/${pageId}/change?r=${rid}&t=${token}&error=slot`);
  }
  // 所要時間（メニュー＋オプション）で終了時刻を再計算
  const menus = await db.reservationMenus.list();
  const dur =
    (r.menuId ? (menus.find((m) => m.id === r.menuId)?.durationMinutes ?? page.durationMinutes) : page.durationMinutes) +
    (r.optionIds ?? []).reduce((s, oid) => s + (menus.find((m) => m.id === oid)?.durationMinutes ?? 0), 0);
  const endMs = start.getTime() + dur * 60000;
  // 新しい枠の定員チェック（自分自身は除外）
  const overlap = (await db.reservations.list()).filter(
    (x) =>
      x.id !== r.id &&
      x.reservationPageId === pageId &&
      x.status === "confirmed" &&
      new Date(x.startAt).getTime() < endMs &&
      start.getTime() < new Date(x.endAt).getTime()
  ).length;
  if (overlap >= page.capacity) {
    redirect(`/yoyaku/${pageId}/change?r=${rid}&t=${token}&error=full`);
  }
  await db.reservations.update(r.id, { startAt: start.toISOString(), endAt: new Date(endMs).toISOString() });
  await finalizeReservationConfirmed(db, r.id, "changed"); // 変更確定LINE＋店舗通知
  revalidatePath(`/reservations/${pageId}`);
  redirect(`/yoyaku/${pageId}/change?r=${rid}&t=${token}&done=1`);
}
