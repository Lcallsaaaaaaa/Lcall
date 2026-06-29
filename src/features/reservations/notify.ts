import type { DataProvider } from "@/lib/data/repository";
import type { Reservation } from "@/lib/data/types";
import { sendEmail } from "@/lib/email";
import { isRealToken, pushText } from "@/lib/line";

function fmtJa(iso: string): string {
  const d = new Date(iso);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 予約の発生／キャンセルを店舗側へ通知する。
 * - LINE: 予約ページの notifyTagId（オーナー/スタッフ等のタグ）を持つ友だち全員へプッシュ。
 * - メール: notifyEmail へ送信（メール送信設定があるときのみ）。
 * いずれも未設定なら何もしない。失敗しても例外は投げない（予約処理を止めない）。
 */
export async function notifyReservation(
  db: DataProvider,
  reservation: Reservation,
  kind: "created" | "cancelled"
): Promise<void> {
  const page = await db.reservationPages.get(reservation.reservationPageId);
  if (!page) return;
  if (!page.notifyTagId && !page.notifyEmail) return;

  const [menus, friends] = await Promise.all([db.reservationMenus.list(), db.friends.list()]);
  const menuName = new Map(menus.map((m) => [m.id, m.name]));
  const customer = reservation.friendId
    ? friends.find((f) => f.id === reservation.friendId)
    : undefined;

  const head = kind === "created" ? "【新規予約】" : "【予約キャンセル】";
  const lines = [`${head}${page.title}`, `日時：${fmtJa(reservation.startAt)}`];
  if (reservation.menuId) {
    const opt = (reservation.optionIds ?? []).map((o) => menuName.get(o)).filter(Boolean);
    lines.push(`メニュー：${menuName.get(reservation.menuId) ?? ""}${opt.length ? `（＋${opt.join("、")}）` : ""}`);
  }
  lines.push(`お客様：${customer?.displayName ?? reservation.name ?? "—"}`);
  if (reservation.phone) lines.push(`電話：${reservation.phone}`);
  if (reservation.note) lines.push(`ご要望：${reservation.note}`);
  const body = lines.join("\n");

  // LINE: 指定タグの友だちへ
  if (page.notifyTagId) {
    try {
      const [friendTags, accounts] = await Promise.all([db.friendTags.list(), db.lineAccounts.list()]);
      const accountById = new Map(accounts.map((a) => [a.id, a]));
      const targetIds = new Set(
        friendTags.filter((ft) => ft.tagId === page.notifyTagId).map((ft) => ft.friendId)
      );
      const targets = friends.filter((f) => targetIds.has(f.id));
      await Promise.all(
        targets.map(async (f) => {
          const acc = accountById.get(f.lineAccountId);
          if (acc && isRealToken(acc.channelAccessToken)) {
            await pushText(acc.channelAccessToken, f.lineUserId, body);
          }
        })
      );
    } catch {
      // LINE通知失敗は無視
    }
  }

  // メール
  if (page.notifyEmail) {
    try {
      await sendEmail({ to: page.notifyEmail, subject: `${head}${page.title}`, text: body });
    } catch {
      // メール失敗は無視
    }
  }
}
