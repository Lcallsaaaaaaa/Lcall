"use server";

import { revalidatePath } from "next/cache";
import { getBroadcast } from "@/features/broadcasts/queries";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { getProfile, isRealToken, pushCarousel, pushText } from "@/lib/line";
import { trackingUrlForRequest } from "@/lib/tracking";
import { applyFriendVars } from "@/lib/vars";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function markThreadRead(friendId: string) {
  const db = getDataProvider();
  const msgs = await db.chatMessages.list();
  await Promise.all(
    msgs
      .filter((m) => m.friendId === friendId && m.direction === "in" && !m.read)
      .map((m) => db.chatMessages.update(m.id, { read: true }))
  );
}

/** スタッフから友だちへ返信（§ スタッフ利用）。
 *  実運用では LINE Messaging API の reply/push をここで呼ぶ（現状は記録のみ＝シミュレート）。 */
export async function sendReply(friendId: string, formData: FormData) {
  const raw = str(formData.get("text"));
  if (raw) {
    const session = await getSession();
    const db = getDataProvider();
    const friend = await db.friends.get(friendId);
    // {{name}}=LINE名 / {friendId}=友だちID を置換（手入力・定型文どちらでも安全に効く）
    const text = applyFriendVars(raw, { displayName: friend?.displayName ?? "", id: friendId });
    await db.chatMessages.create({
      id: uid("cm"),
      friendId,
      direction: "out",
      text,
      staffName: session?.name ?? "スタッフ",
      read: true,
      createdAt: new Date().toISOString(),
    });
    await markThreadRead(friendId);
    // スタッフが手動返信したらAIは一時停止（有人対応へ。受信箱で再開可）
    await db.friends.update(friendId, { aiPaused: true });

    // 実LINE送信: 該当アカウントに本物のトークンがあれば Messaging API で push。
    // 未設定/ダミートークン（ローカル・デモ）では記録のみ。
    const account = friend ? await db.lineAccounts.get(friend.lineAccountId) : null;
    if (friend && account && isRealToken(account.channelAccessToken)) {
      await pushText(account.channelAccessToken, friend.lineUserId, text);
    }
  }
  revalidatePath("/inbox");
}

/** スレッドを既読化（開いたとき）。 */
export async function markRead(friendId: string) {
  await markThreadRead(friendId);
  revalidatePath("/inbox");
}

/** 受信をシミュレート（実運用では LINE Webhook が inbound を作成）。 */
export async function simulateInbound(friendId: string) {
  await getDataProvider().chatMessages.create({
    id: uid("cm"),
    friendId,
    direction: "in",
    text: "（テスト受信）ご連絡ありがとうございます。",
    read: false,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/inbox");
}

/** 管理用の表示名を変更（LINE上の本名は変更不可）。 */
export async function renameFriend(friendId: string, formData: FormData) {
  const name = str(formData.get("name"));
  if (name) await getDataProvider().friends.update(friendId, { displayName: name });
  revalidatePath("/inbox");
  revalidatePath("/friends");
  revalidatePath(`/friends/${friendId}`);
}

/** LINEプロフィールを再取得（実トークン時）。 */
export async function refreshProfile(friendId: string) {
  const db = getDataProvider();
  const friend = await db.friends.get(friendId);
  if (!friend) return;
  const account = await db.lineAccounts.get(friend.lineAccountId);
  if (account && isRealToken(account.channelAccessToken)) {
    const p = await getProfile(account.channelAccessToken, friend.lineUserId);
    await db.friends.update(friendId, {
      displayName: p.displayName ?? friend.displayName,
      pictureUrl: p.pictureUrl ?? friend.pictureUrl,
    });
  }
  revalidatePath("/inbox");
}

async function recordOutbound(friendId: string, text: string) {
  const db = getDataProvider();
  const session = await getSession();
  await db.chatMessages.create({
    id: uid("cm"),
    friendId,
    direction: "out",
    text,
    staffName: session?.name ?? "スタッフ",
    read: true,
    createdAt: new Date().toISOString(),
  });
  await markThreadRead(friendId);
  await db.friends.update(friendId, { aiPaused: true });
}

/** この友だちのAI自動応答を一時停止/再開（有人対応の切替）。 */
export async function toggleAiPaused(friendId: string) {
  const db = getDataProvider();
  const friend = await db.friends.get(friendId);
  if (friend) await db.friends.update(friendId, { aiPaused: !friend.aiPaused });
  revalidatePath("/inbox");
}

/** この友だち専用のAIキャラを設定（空でアカウント/タグの解決に戻す）。 */
export async function setFriendCharacter(friendId: string, formData: FormData) {
  const id = str(formData.get("aiCharacterId"));
  await getDataProvider().friends.update(friendId, { aiCharacterId: id || undefined });
  revalidatePath("/inbox");
}

/** 定型文を選んで送信。 */
export async function sendTemplate(friendId: string, formData: FormData) {
  const templateId = str(formData.get("templateId"));
  const db = getDataProvider();
  const tpl = templateId ? await db.messageTemplates.get(templateId) : null;
  if (tpl) {
    const friend = await db.friends.get(friendId);
    const text = applyFriendVars(tpl.text, { displayName: friend?.displayName ?? "", id: friendId });
    await recordOutbound(friendId, text);
    const account = friend ? await db.lineAccounts.get(friend.lineAccountId) : null;
    if (friend && account && isRealToken(account.channelAccessToken)) {
      await pushText(account.channelAccessToken, friend.lineUserId, text);
    }
  }
  revalidatePath("/inbox");
}

/** カルーセル配信を選んで1:1で送信。 */
export async function sendCarousel(friendId: string, formData: FormData) {
  const broadcastId = str(formData.get("broadcastId"));
  const db = getDataProvider();
  const friend = await db.friends.get(friendId);
  const detail = broadcastId ? await getBroadcast(broadcastId) : null;
  if (friend && detail && detail.cards.length > 0) {
    await recordOutbound(friendId, `［カルーセル送信］${detail.broadcast.title}（${detail.cards.length}枚）`);
    const account = await db.lineAccounts.get(friend.lineAccountId);
    if (account && isRealToken(account.channelAccessToken)) {
      await pushCarousel(
        account.channelAccessToken,
        friend.lineUserId,
        detail.broadcast.title,
        await Promise.all(
          detail.cards.map(async (c) => ({
            thumbnailImageUrl: c.imageUrl || undefined,
            title: c.title,
            text: c.description,
            uri: await trackingUrlForRequest(c.trackingId, friendId),
            label: c.buttonLabel,
          }))
        )
      );
    }
  }
  revalidatePath("/inbox");
}
