import type { DataProvider } from "@/lib/data/repository";
import { isRealToken, pushText } from "@/lib/line";
import { isOperationsSuspended } from "@/lib/operator";

const REMIND_WINDOW_MS = 24 * 60 * 60 * 1000; // 開始24時間前以内になったら送る

function fmtJa(iso: string): string {
  const d = new Date(iso);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 開始が近い予約（24時間以内・未リマインド・confirmed）に LINE リマインドを送る。
 * cron（/api/scenarios/run）から毎回呼ぶ。実トークン時のみ実送信。
 * remindedAt を先に立てて重複送信を防ぐ。
 */
export async function processReservationReminders(
  db: DataProvider,
  now: Date = new Date()
): Promise<{ reminded: number }> {
  if (await isOperationsSuspended(db)) return { reminded: 0 };
  const reservations = await db.reservations.list();
  // 事前支払いの仮押さえ(pending)が30分以上未決済なら自動キャンセル（枠を解放・予約表を整理）
  const HOLD_MS = 30 * 60 * 1000;
  for (const r of reservations) {
    if (r.status === "pending" && now.getTime() - new Date(r.createdAt).getTime() > HOLD_MS) {
      await db.reservations.update(r.id, { status: "cancelled" });
    }
  }
  const due = reservations.filter((r) => {
    if (r.status !== "confirmed" || r.remindedAt) return false;
    const t = new Date(r.startAt).getTime();
    return t > now.getTime() && t - now.getTime() <= REMIND_WINDOW_MS;
  });
  if (due.length === 0) return { reminded: 0 };

  const [friends, accounts, pages, menus] = await Promise.all([
    db.friends.list(),
    db.lineAccounts.list(),
    db.reservationPages.list(),
    db.reservationMenus.list(),
  ]);
  const friendById = new Map(friends.map((f) => [f.id, f]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const menuById = new Map(menus.map((m) => [m.id, m]));

  let reminded = 0;
  for (const r of due) {
    // 先にマークして重複送信を防止（push失敗でも再送しない）
    await db.reservations.update(r.id, { remindedAt: now.toISOString() });
    const friend = r.friendId ? friendById.get(r.friendId) : undefined;
    if (!friend) continue;
    const acc = accountById.get(friend.lineAccountId);
    if (!acc || !isRealToken(acc.channelAccessToken)) continue;
    const page = pageById.get(r.reservationPageId);
    const menu = r.menuId ? menuById.get(r.menuId) : undefined;
    const lines = [
      `【ご予約リマインド】${page?.title ?? ""}`.trim(),
      `日時：${fmtJa(r.startAt)}`,
    ];
    if (menu) lines.push(`メニュー：${menu.name}`);
    const base = process.env.LCALL_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
    if (base && r.cancelToken) {
      lines.push(`\nご予約の確認・キャンセルはこちら：\n${base}/yoyaku/${r.reservationPageId}/cancel?r=${r.id}&t=${r.cancelToken}`);
    }
    await pushText(acc.channelAccessToken, friend.lineUserId, lines.join("\n"));
    reminded++;
  }
  return { reminded };
}
