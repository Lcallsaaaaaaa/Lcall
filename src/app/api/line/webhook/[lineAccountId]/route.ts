import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data/provider";
import type { DataProvider } from "@/lib/data/repository";
import type { Friend, LineAccount } from "@/lib/data/types";
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
      const friend = await findOrCreateFriend(db, account, userId);
      // 再フォロー時はブロック解除（status=active・ブロック日時クリア）
      if (friend.status !== "active" || friend.blockedAt) {
        await db.friends.update(friend.id, { status: "active", blockedAt: undefined });
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
      const friend = await findOrCreateFriend(db, account, userId);
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
              imageUrl = await saveImageBytes(content.buffer, content.contentType ?? "image/jpeg");
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

async function findOrCreateFriend(
  db: DataProvider,
  account: LineAccount,
  userId: string
): Promise<Friend> {
  const friends = await db.friends.list();
  const existing = friends.find((f) => f.lineUserId === userId);
  if (existing) return existing;

  let displayName = "LINEユーザー";
  let pictureUrl: string | undefined;
  if (isRealToken(account.channelAccessToken)) {
    const profile = await getProfile(account.channelAccessToken, userId);
    if (profile.displayName) displayName = profile.displayName;
    pictureUrl = profile.pictureUrl;
  }

  // 流入元（広告コード）を直近の登録ログから推定（60分以内）。
  // 同一アカウントの直近を優先し、無ければ全体の直近（クリックと友だち追加は別リクエストのため推定）。
  const cutoff = Date.now() - 60 * 60 * 1000;
  const adLogs = (await db.distributionLogs.list())
    .filter((l) => l.adCode && new Date(l.createdAt).getTime() >= cutoff)
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
  };
  await db.friends.create(friend);
  return friend;
}
