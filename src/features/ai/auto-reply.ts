import type { DataProvider } from "@/lib/data/repository";
import type { AiCharacter, Friend, LineAccount } from "@/lib/data/types";
import { buildSystemPrompt, generateAiReply, resolveAiApiKey, type AiTurn } from "@/lib/anthropic";

const HISTORY_LIMIT = 12;

/** 有人対応へ切り替えたいキーワード（含まれたらAIは応答せず、その友だちのAIを停止）。 */
const ESCALATION_KEYWORDS = ["オペレーター", "担当者", "人と話", "電話して", "クレーム"];

export function wantsHuman(text: string): boolean {
  return ESCALATION_KEYWORDS.some((k) => text.includes(k));
}

/** Anthropic の制約（user始まり・role交互）に整形する。 */
function normalizeTurns(turns: AiTurn[]): AiTurn[] {
  let i = 0;
  while (i < turns.length && turns[i].role === "assistant") i++;
  const out: AiTurn[] = [];
  for (const t of turns.slice(i)) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += "\n" + t.content;
    else out.push({ ...t });
  }
  return out;
}

/**
 * 適用するAIキャラを解決する。優先順位:
 *   友だち専用 > 友だちのタグ（セグメント） > アカウント既定。
 */
export async function resolveCharacter(
  db: DataProvider,
  account: LineAccount,
  friend: Friend
): Promise<AiCharacter | null> {
  if (friend.aiCharacterId) {
    const c = await db.aiCharacters.get(friend.aiCharacterId);
    if (c) return c;
  }
  const fts = (await db.friendTags.list()).filter((ft) => ft.friendId === friend.id);
  if (fts.length > 0) {
    const tags = await db.tags.list();
    const tagById = new Map(tags.map((t) => [t.id, t]));
    for (const ft of fts) {
      const cid = tagById.get(ft.tagId)?.aiCharacterId;
      if (cid) {
        const c = await db.aiCharacters.get(cid);
        if (c) return c;
      }
    }
  }
  if (account.aiCharacterId) {
    const c = await db.aiCharacters.get(account.aiCharacterId);
    if (c) return c;
  }
  return null;
}

/**
 * 受信テキストに対する AI 自動返信を生成する。条件を満たさなければ null。
 *  - account.aiEnabled が false → null / APIキー未解決 → null / friend.aiPaused → null
 *  - 直近が友だち発言でない → null
 * キャラは 友だち>タグ>アカウント で解決（未解決なら汎用）。返信文とキャラ名を返す。
 */
export async function generateAutoReply(
  db: DataProvider,
  account: LineAccount,
  friendId: string
): Promise<{ text: string; characterName: string } | null> {
  if (!account.aiEnabled) return null;
  const apiKey = resolveAiApiKey(account.aiApiKey);
  if (!apiKey) return null;

  const friend = await db.friends.get(friendId);
  if (!friend || friend.aiPaused) return null;

  const all = await db.chatMessages.list();
  const history = all
    .filter((m) => m.friendId === friendId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .slice(-HISTORY_LIMIT);
  if (history.length === 0 || history[history.length - 1].direction !== "in") return null;

  const turns = normalizeTurns(
    history.map((m) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: m.imageUrl ? "[画像]" : m.text,
    }))
  );
  if (turns.length === 0) return null;

  const character = await resolveCharacter(db, account, friend);
  const system = buildSystemPrompt({
    name: character?.name,
    instruction: character?.persona,
    faq: character?.faq,
  });
  const result = await generateAiReply({ apiKey, system, messages: turns, model: character?.model });
  if (!result.ok || !result.text) {
    console.warn(`[AI] 返信生成に失敗 (status=${result.status}): ${result.error ?? "本文なし"}`);
    return null;
  }
  return { text: result.text, characterName: character?.name ?? "AI" };
}
