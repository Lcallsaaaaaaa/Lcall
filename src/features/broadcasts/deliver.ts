import type { DataProvider } from "@/lib/data/repository";
import { isRealToken, pushCarousel, pushText } from "@/lib/line";
import { isOperationsSuspended } from "@/lib/operator";
import { trackingUrl } from "@/lib/tracking";
import { applyFriendVars } from "@/lib/vars";
import { getBroadcast, resolveRecipients } from "./queries";

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/**
 * 配信を実行する（対象解決 → 実LINE push〔実トークン時〕→ 配信記録 → status=sent）。
 * 「今すぐ送信」と予約配信ランナーの両方から共用。送信済み/不在なら何もしない。
 */
export async function deliverBroadcast(db: DataProvider, id: string): Promise<boolean> {
  // 運営により一時停止中は送信しない（遠隔操作）。
  if (await isOperationsSuspended(db)) return false;
  const b = await db.broadcasts.get(id);
  if (!b || b.status === "sent") return false;

  const recipients = await resolveRecipients(db, b.targetTagIds, b.lineAccountId);
  const accounts = await db.lineAccounts.list();
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const cards = b.type === "carousel" ? ((await getBroadcast(id))?.cards ?? []) : [];

  await Promise.all(
    recipients.map(async (f) => {
      await db.broadcastTargets.create({
        id: uid("bt"),
        broadcastId: id,
        friendId: f.id,
        delivered: true,
      });
      const acc = accountById.get(f.lineAccountId);
      if (!acc || !isRealToken(acc.channelAccessToken)) return;
      if (b.type === "carousel") {
        if (cards.length > 0) {
          await pushCarousel(
            acc.channelAccessToken,
            f.lineUserId,
            b.title,
            cards.map((c) => ({
              thumbnailImageUrl: c.imageUrl || undefined,
              title: c.title,
              text: c.description,
              uri: trackingUrl(c.trackingId, f.id),
              label: c.buttonLabel,
            }))
          );
        }
      } else {
        // {{name}}/{friendId} を置換（フォームURLに {friendId} を入れると回答者をLINE名で記録）
        await pushText(acc.channelAccessToken, f.lineUserId, applyFriendVars(b.text ?? b.title, f));
      }
    })
  );

  await db.broadcasts.update(id, {
    status: "sent",
    sentAt: new Date().toISOString(),
    sentCount: recipients.length,
  });
  return true;
}

/**
 * 予約時刻が到来した配信（status=scheduled かつ scheduledAt <= now）を送信する。
 * 定期実行（cron）から呼ぶ想定。
 */
export async function processDueBroadcasts(
  db: DataProvider,
  now: Date = new Date()
): Promise<{ sent: string[]; count: number }> {
  const broadcasts = await db.broadcasts.list();
  const due = broadcasts
    .filter(
      (b) =>
        b.status === "scheduled" &&
        b.scheduledAt != null &&
        new Date(b.scheduledAt).getTime() <= now.getTime()
    )
    .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));

  const sent: string[] = [];
  for (const b of due) {
    if (await deliverBroadcast(db, b.id)) sent.push(b.id);
  }
  return { sent, count: sent.length };
}
