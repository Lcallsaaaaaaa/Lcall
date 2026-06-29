import type { DataProvider } from "@/lib/data/repository";
import { isRealToken, pushText } from "@/lib/line";
import { applyNameVars } from "@/lib/vars";
import { notifyReservation } from "./notify";

function fmtJa(iso: string): string {
  const d = new Date(iso);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/**
 * 予約確定後の共通処理：タグ付与・予約者へ確定LINE（取消リンク付き）・店舗へ通知。
 * 無料予約は createReservation から、事前支払いは Stripe webhook（決済成功）から呼ぶ。
 */
export async function finalizeReservationConfirmed(
  db: DataProvider,
  reservationId: string,
  kind: "created" | "changed" = "created",
  notifyStore = true
): Promise<void> {
  const r = await db.reservations.get(reservationId);
  if (!r) return;
  const page = await db.reservationPages.get(r.reservationPageId);
  if (!page) return;

  // 予約時タグ付与
  if (page.autoTagId && r.friendId) {
    const tags = await db.friendTags.list();
    if (!tags.some((t) => t.friendId === r.friendId && t.tagId === page.autoTagId)) {
      await db.friendTags.create({
        id: uid("ft"),
        friendId: r.friendId,
        tagId: page.autoTagId,
        auto: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 予約者へ確定の連絡：チャット履歴に out として記録（スタッフが送信内容を確認できる）し、
  // 実トークンがあれば実際に LINE 送信もする（ダミートークンのデモ環境では記録のみ）。
  if (r.friendId) {
    const friend = await db.friends.get(r.friendId);
    const account = friend ? await db.lineAccounts.get(friend.lineAccountId) : null;
    if (friend) {
      const menus = await db.reservationMenus.list();
      const menu = r.menuId ? menus.find((m) => m.id === r.menuId) : null;
      const opts = (r.optionIds ?? [])
        .map((o) => menus.find((m) => m.id === o))
        .filter((m): m is NonNullable<typeof m> => !!m);
      const defaultHead = kind === "changed" ? "ご予約の日時を変更しました。" : "ご予約を承りました。";
      const head = kind === "created" && page.confirmText ? applyNameVars(page.confirmText, friend.displayName) : defaultHead;
      const lines = [head, `日付：${fmtJa(r.startAt)}`];
      if (menu) lines.push(`サービス：${menu.name}`);
      if (opts.length) lines.push(`オプション：${opts.map((o) => o.name).join("、")}`);
      // 料金（メニュー＋オプションの合計。価格設定がある場合）
      const priceParts = [menu?.price, ...opts.map((o) => o.price)].filter(
        (p): p is number => typeof p === "number"
      );
      if (priceParts.length) {
        const total = priceParts.reduce((s, p) => s + p, 0);
        const paidNote = r.paymentStatus === "paid" ? "（決済済み）" : "";
        lines.push(`料金：¥${total.toLocaleString()}${paidNote}`);
      }
      const base = process.env.LCALL_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
      if (base && r.cancelToken) {
        lines.push(`\nご予約の確認・キャンセルはこちら：\n${base}/yoyaku/${r.reservationPageId}/cancel?r=${r.id}&t=${r.cancelToken}`);
      }
      const text = lines.join("\n");
      // チャットに送信ログを残す（スタッフが「確認LINEを送ったか」を受信箱で確認できる）
      await db.chatMessages.create({
        id: uid("cm"),
        friendId: friend.id,
        direction: "out",
        text,
        staffName: "予約システム",
        read: true,
        createdAt: new Date().toISOString(),
      });
      if (account && isRealToken(account.channelAccessToken)) {
        await pushText(account.channelAccessToken, friend.lineUserId, text);
      }
    }
  }

  // 店舗側へ通知（指定タグの友だちへLINE＋指定メール）。予約時に通知済みのケースでは skip。
  if (notifyStore) await notifyReservation(db, r, kind);
}
