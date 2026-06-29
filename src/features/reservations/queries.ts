import { getDataProvider } from "@/lib/data/provider";
import type { Reservation, ReservationMenu, ReservationPage } from "@/lib/data/types";
import { type DayOption, type SlotOption, dayOptions, daySlots } from "./availability";

export interface ReservationPageRow extends ReservationPage {
  menuCount: number;
  upcomingCount: number;
}

export async function listReservationPages(): Promise<ReservationPageRow[]> {
  const db = getDataProvider();
  const [pages, menus, reservations] = await Promise.all([
    db.reservationPages.list(),
    db.reservationMenus.list(),
    db.reservations.list(),
  ]);
  const now = Date.now();
  const menuCount = new Map<string, number>();
  for (const m of menus) {
    if (m.kind === "option") continue; // 基本メニューのみ数える
    menuCount.set(m.reservationPageId, (menuCount.get(m.reservationPageId) ?? 0) + 1);
  }
  const upcoming = new Map<string, number>();
  for (const r of reservations) {
    if (r.status === "confirmed" && new Date(r.startAt).getTime() >= now) {
      upcoming.set(r.reservationPageId, (upcoming.get(r.reservationPageId) ?? 0) + 1);
    }
  }
  return pages
    .map((p) => ({
      ...p,
      menuCount: menuCount.get(p.id) ?? 0,
      upcomingCount: upcoming.get(p.id) ?? 0,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface ReservationPageDetail {
  page: ReservationPage;
  menus: ReservationMenu[];
  options: ReservationMenu[];
}

export async function getReservationPage(id: string): Promise<ReservationPageDetail | null> {
  const db = getDataProvider();
  const page = await db.reservationPages.get(id);
  if (!page) return null;
  const all = (await db.reservationMenus.list())
    .filter((m) => m.reservationPageId === id)
    .sort((a, b) => a.order - b.order);
  return {
    page,
    menus: all.filter((m) => m.kind !== "option"),
    options: all.filter((m) => m.kind === "option"),
  };
}

export interface ReservationRow extends Reservation {
  friendName: string;
  menuName?: string;
  optionNames: string[];
}

/** 管理用：予約表の予約一覧（新しい開始日時順）。 */
export async function getPageReservations(id: string): Promise<ReservationRow[]> {
  const db = getDataProvider();
  const [reservations, friends, menus] = await Promise.all([
    db.reservations.list(),
    db.friends.list(),
    db.reservationMenus.list(),
  ]);
  const friendName = new Map(friends.map((f) => [f.id, f.displayName]));
  const menuName = new Map(menus.map((m) => [m.id, m.name]));
  return reservations
    .filter((r) => r.reservationPageId === id)
    .sort((a, b) => (a.startAt < b.startAt ? 1 : -1))
    .map((r) => ({
      ...r,
      friendName: r.friendId ? (friendName.get(r.friendId) ?? "—") : (r.name || "—"),
      menuName: r.menuId ? menuName.get(r.menuId) : undefined,
      optionNames: (r.optionIds ?? []).map((oid) => menuName.get(oid)).filter((n): n is string => !!n),
    }));
}

export interface BookingView {
  page: ReservationPage;
  menus: ReservationMenu[];
  options: ReservationMenu[];
  days: DayOption[];
  selectedMenu?: ReservationMenu;
  selectedOptions: ReservationMenu[];
  totalDuration: number;
  totalPrice?: number;
  selectedDate?: string;
  slots: SlotOption[];
}

/** 公開予約ページ用：メニュー・オプション・予約可能日・選択日の枠を計算。 */
export async function getBookingView(
  id: string,
  opts: { date?: string; menuId?: string; optionIds?: string[] } = {}
): Promise<BookingView | null> {
  const db = getDataProvider();
  const page = await db.reservationPages.get(id);
  if (!page) return null;
  const [allMenus, reservations] = await Promise.all([
    db.reservationMenus.list(),
    db.reservations.list(),
  ]);
  const pageMenus = allMenus
    .filter((m) => m.reservationPageId === id)
    .sort((a, b) => a.order - b.order);
  const menus = pageMenus.filter((m) => m.kind !== "option");
  const options = pageMenus.filter((m) => m.kind === "option");
  const days = dayOptions(page);

  const selectedMenu = opts.menuId ? menus.find((m) => m.id === opts.menuId) : undefined;
  const selectedOptions = (opts.optionIds ?? [])
    .map((oid) => options.find((o) => o.id === oid))
    .filter((o): o is ReservationMenu => !!o);

  // 合計所要時間・料金（基本メニュー＋オプション）
  const baseDuration =
    page.type === "menu" ? (selectedMenu?.durationMinutes ?? page.durationMinutes) : page.durationMinutes;
  const totalDuration = baseDuration + selectedOptions.reduce((s, o) => s + o.durationMinutes, 0);
  const priceParts = [selectedMenu?.price, ...selectedOptions.map((o) => o.price)].filter(
    (p): p is number => typeof p === "number"
  );
  const totalPrice = priceParts.length ? priceParts.reduce((s, p) => s + p, 0) : undefined;

  let slots: SlotOption[] = [];
  const selectedDate = opts.date && days.some((d) => d.value === opts.date) ? opts.date : undefined;
  // メニュー型はメニュー選択後のみ枠を出す
  const ready = page.type === "simple" || !!selectedMenu;
  if (selectedDate && ready) {
    const dayRes = reservations.filter((r) => r.reservationPageId === id);
    slots = daySlots(page, selectedDate, totalDuration, dayRes);
  }
  return { page, menus, options, days, selectedMenu, selectedOptions, totalDuration, totalPrice, selectedDate, slots };
}

export interface FriendReservation {
  id: string;
  pageTitle: string;
  menuName?: string;
  startAt: string;
  status: Reservation["status"];
}

/** 顧客詳細用：その友だちの予約履歴。 */
export async function getFriendReservations(friendId: string): Promise<FriendReservation[]> {
  const db = getDataProvider();
  const [reservations, pages, menus] = await Promise.all([
    db.reservations.list(),
    db.reservationPages.list(),
    db.reservationMenus.list(),
  ]);
  const pageTitle = new Map(pages.map((p) => [p.id, p.title]));
  const menuName = new Map(menus.map((m) => [m.id, m.name]));
  return reservations
    .filter((r) => r.friendId === friendId)
    .sort((a, b) => (a.startAt < b.startAt ? 1 : -1))
    .map((r) => ({
      id: r.id,
      pageTitle: pageTitle.get(r.reservationPageId) ?? r.reservationPageId,
      menuName: r.menuId ? menuName.get(r.menuId) : undefined,
      startAt: r.startAt,
      status: r.status,
    }));
}
