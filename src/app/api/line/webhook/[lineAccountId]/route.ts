import { revalidatePath } from "next/cache";
import { sendFriendAddConversion } from "@/lib/ads-send";
import { getDataProvider } from "@/lib/data/provider";
import type { DataProvider } from "@/lib/data/repository";
import type { DistributionLog, Friend, LineAccount } from "@/lib/data/types";
import { getMessageContent, getProfile, isRealToken, pushText, verifyLineSignature } from "@/lib/line";
import { saveImageBytes } from "@/lib/storage";
import { generateAutoReply, wantsHuman } from "@/features/ai/auto-reply";
import { processScenarios } from "@/features/scenarios/process";

/**
 * LINE Messaging API の Webhook 受信（アカウント別）。
 * LINE Developers の Webhook URL に {origin}/api/line/webhook/{lineAccountId} を登録する。
 *
 * - 署名（X-Line-Signature）を該当アカウントの channelSecret で検証
 * - message(text) / follow を処理し、lineUserId で顧客を find/create
 * - 受信は inbound の ChatMessage として保存 → /inbox に表示
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ lineAccountId: string }> }
) {
  const { lineAccountId } = await params;
  const db = getDataProvider();
  const account = await db.lineAccounts.get(lineAccountId);
  if (!account) return new Response("unknown account", { status: 404 });

  const raw = await request.text();
  const signature = request.headers.get("x-line-signature");
  if (!verifyLineSignature(account.channelSecret, raw, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let body: { events?: unknown[] };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const events = Array.isArray(body.events) ? body.events : [];

  for (const ev of events as Array<Record<string, any>>) {
    const userId: string | undefined = ev?.source?.userId;
    if (!userId) continue;

    if (ev.type === "follow") {
      const { friend, isNew, matchedLog } = await findOrCreateFriend(db, account, userId);
      // 再フォロー時はブロック解除（status=active・ブロック日時クリア）
      if (friend.status !== "active" || friend.blockedAt) {
        await db.friends.update(friend.id, { status: "active", blockedAt: undefined });
      }
      // 新規友だち追加＝コンバージョン。広告クリックIDがあれば Meta/Google へサーバー側送信
      //（環境変数が未設定なら自動スキップ。失敗しても以降の処理は止めない）
      if (isNew) {
        try {
          await sendFriendAddConversion(db, {
            friendId: friend.id,
            adCode: matchedLog?.adCode,
            gclid: matchedLog?.gclid,
            fbclid: matchedLog?.fbclid,
            fbp: matchedLog?.fbp,
            clientIp: matchedLog?.clientIp,
            userAgent: matchedLog?.userAgent,
            clickTimeMs: matchedLog ? new Date(matchedLog.createdAt).getTime() : undefined,
          });
        } catch {
          // コンバージョン送信失敗で挨拶配信を止めない
        }
      }
      // Web予約後に友だち追加した人を、直近の未紐づけ予約へ自動で紐づけ（前日リマインドが届くように）
      try {
        await linkPendingReservation(db, account.id, friend.id);
      } catch {
        // 紐づけ失敗で挨拶配信を止めない
      }
      // 追加時挨拶＋即時配信ステップ（delay 0）を送る
      await processScenarios(db, { friendId: friend.id });
    } else if (ev.type === "unfollow") {
      // ブロック：status=blocked＋ブロック日時を記録
      const friends = await db.friends.list();
      const friend = friends.find((f) => f.lineUserId === userId);
      if (friend) {
        await db.friends.update(friend.id, {
          status: "blocked",
          blockedAt: new Date(typeof ev.timestamp === "number" ? ev.timestamp : Date.now()).toISOString(),
        });
      }
    } else if (ev.type === "message") {
      const { friend } = await findOrCreateFriend(db, account, userId);
      const msg = ev.message ?? {};
      let text = "";
      let imageUrl: string | undefined;

      if (msg.type === "text") {
        text = String(msg.text ?? "");
      } else if (msg.type === "image") {
        text = "[画像]";
        if (!isRealToken(account.channelAccessToken)) {
          text = "[画像]（アクセストークン未設定のため取得できません）";
        } else if (msg.id) {
          const content = await getMessageContent(account.channelAccessToken, String(msg.id));
          if (content.ok && content.buffer) {
            try {
              imageUrl = await saveImageBytes(content.buffer, content.contentType ?? "image/jpeg", "chat");
            } catch {
              text = "[画像]（保存に失敗しました）";
            }
          } else {
            text = "[画像]（取得に失敗しました）";
          }
        }
      } else {
        const labels: Record<string, string> = {
          sticker: "[スタンプ]",
          video: "[動画]",
          audio: "[音声]",
          file: "[ファイル]",
          location: "[位置情報]",
        };
        text = labels[String(msg.type)] ?? `[${String(msg.type ?? "メッセージ")}]`;
      }

      await db.chatMessages.create({
        id: `cm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        friendId: friend.id,
        direction: "in",
        text,
        ...(imageUrl ? { imageUrl } : {}),
        read: false,
        createdAt: new Date(typeof ev.timestamp === "number" ? ev.timestamp : Date.now()).toISOString(),
      });

      // AI自動応答（このアカウントで有効・テキスト受信時のみ）
      if (account.aiEnabled && msg.type === "text" && text) {
        if (wantsHuman(text)) {
          // 有人対応へエスカレーション：この友だちのAIを停止
          await db.friends.update(friend.id, { aiPaused: true });
        } else {
          const reply = await generateAutoReply(db, account, friend.id);
          if (reply) {
            if (isRealToken(account.channelAccessToken)) {
              await pushText(account.channelAccessToken, userId, reply.text);
            }
            await db.chatMessages.create({
              id: `cm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
              friendId: friend.id,
              direction: "out",
              text: reply.text,
              staffName: `AI（${reply.characterName}）`,
              ai: true,
              read: true,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  revalidatePath("/inbox");
  return new Response("ok");
}

/**
 * Web予約（友だち未紐づけ）を、友だち追加した人へ推定で紐づける（60分以内・直近1件）。
 * 予約時に決めた lineAccountId が一致するもの優先。共通（未指定）予約はアカウント不問で拾う。
 * これにより「予約→友だち追加」した新規客にも前日リマインドが届く。
 */
async function linkPendingReservation(db: DataProvider, accountId: string, friendId: string): Promise<void> {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const pending = (await db.reservations.list())
    .filter(
      (r) =>
        r.status === "confirmed" &&
        !r.friendId &&
        new Date(r.createdAt).getTime() >= cutoff &&
        (!r.lineAccountId || r.lineAccountId === accountId)
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const r = pending[0];
  if (r) await db.reservations.update(r.id, { friendId, lineAccountId: accountId });
}

async function findOrCreateFriend(
  db: DataProvider,
  account: LineAccount,
  userId: string
): Promise<{ friend: Friend; isNew: boolean; matchedLog?: DistributionLog }> {
  const friends = await db.friends.list();
  const existing = friends.find((f) => f.lineUserId === userId);
  if (existing) return { friend: existing, isNew: false };

  let displayName = "LINEユーザー";
  let pictureUrl: string | undefined;
  if (isRealToken(account.channelAccessToken)) {
    const profile = await getProfile(account.channelAccessToken, userId);
    if (profile.displayName) displayName = profile.displayName;
    pictureUrl = profile.pictureUrl;
  }

  // 流入元（広告コード／クリックID）を直近の登録ログから推定（60分以内・未紐づけ）。
  // 同一アカウントの直近を優先し、無ければ全体の直近（クリックと友だち追加は別リクエストのため推定）。
  const cutoff = Date.now() - 60 * 60 * 1000;
  const adLogs = (await db.distributionLogs.list())
    .filter(
      (l) =>
        (l.adCode || l.gclid || l.fbclid) &&
        !l.friendId &&
        new Date(l.createdAt).getTime() >= cutoff
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const recent = adLogs.find((l) => l.assignedLineAccountId === account.id) ?? adLogs[0];

  const friend: Friend = {
    id: `fr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    lineUserId: userId,
    displayName,
    pictureUrl,
    lineAccountId: account.id,
    registeredAt: new Date().toISOString(),
    ltv: 0,
    status: "active",
    sourceCode: recent?.adCode,
    gclid: recent?.gclid,
    fbclid: recent?.fbclid,
  };
  await db.friends.create(friend);
  // ログを友だちに紐づけ（コンバージョン重複送信・二重マッチを防止）
  if (recent) {
    await db.distributionLogs.update(recent.id, {
      friendId: friend.id,
      convertedAt: new Date().toISOString(),
    });
  }
  return { friend, isNew: true, matchedLog: recent };
}
