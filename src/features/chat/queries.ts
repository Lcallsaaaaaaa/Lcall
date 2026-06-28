import { getDataProvider } from "@/lib/data/provider";
import type { AiCharacter, ChatMessage, Friend, Tag } from "@/lib/data/types";

export interface ChatThread {
  friendId: string;
  friendName: string;
  lineAccountName?: string;
  lastText: string;
  lastAt: string;
  lastDirection: ChatMessage["direction"];
  unread: number;
}

export async function listThreads(): Promise<ChatThread[]> {
  const db = getDataProvider();
  const [messages, friends, accounts] = await Promise.all([
    db.chatMessages.list(),
    db.friends.list(),
    db.lineAccounts.list(),
  ]);
  const friendById = new Map(friends.map((f) => [f.id, f]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const byFriend = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    const arr = byFriend.get(m.friendId) ?? [];
    arr.push(m);
    byFriend.set(m.friendId, arr);
  }

  const threads: ChatThread[] = [];
  for (const [friendId, msgs] of byFriend) {
    const friend = friendById.get(friendId);
    if (!friend) continue;
    msgs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const last = msgs[0];
    threads.push({
      friendId,
      friendName: friend.displayName,
      lineAccountName: accountName.get(friend.lineAccountId),
      lastText: last.text,
      lastAt: last.createdAt,
      lastDirection: last.direction,
      unread: msgs.filter((m) => m.direction === "in" && !m.read).length,
    });
  }
  return threads.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export interface FriendTagRef {
  friendTagId: string;
  tag: Tag;
}

export interface ThreadView {
  friend: Friend;
  lineAccountName?: string;
  /** 流入元（広告コードのラベル） */
  sourceLabel?: string;
  /** 所属アカウントでAI自動応答が有効か */
  aiEnabled: boolean;
  /** AIキャラ一覧（友だち個別の出し分け用） */
  aiCharacters: AiCharacter[];
  tags: FriendTagRef[];
  messages: ChatMessage[];
}

export async function getThread(friendId: string): Promise<ThreadView | null> {
  const db = getDataProvider();
  const friend = await db.friends.get(friendId);
  if (!friend) return null;
  const [messages, accounts, friendTags, tags, adCodes, aiCharacters] = await Promise.all([
    db.chatMessages.list(),
    db.lineAccounts.list(),
    db.friendTags.list(),
    db.tags.list(),
    db.adCodes.list(),
    db.aiCharacters.list(),
  ]);
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const account = accounts.find((a) => a.id === friend.lineAccountId);

  return {
    friend,
    lineAccountName: account?.name,
    aiEnabled: !!account?.aiEnabled,
    aiCharacters: aiCharacters.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    sourceLabel: friend.sourceCode
      ? (adCodes.find((a) => a.code === friend.sourceCode)?.label ?? friend.sourceCode)
      : undefined,
    tags: friendTags
      .filter((ft) => ft.friendId === friendId)
      .map((ft) => ({ friendTagId: ft.id, tag: tagById.get(ft.tagId)! }))
      .filter((r) => r.tag),
    messages: messages
      .filter((m) => m.friendId === friendId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
  };
}

export async function totalUnread(): Promise<number> {
  const messages = await getDataProvider().chatMessages.list();
  return messages.filter((m) => m.direction === "in" && !m.read).length;
}

export interface AddedFriendRow {
  friendId: string;
  friendName: string;
  registeredAt: string;
  lineAccountName?: string;
}

/** まだチャット履歴がない（追加されたばかりの）友だちを新しい順に。 */
export async function recentAddedFriends(limit = 20): Promise<AddedFriendRow[]> {
  const db = getDataProvider();
  const [friends, messages, accounts] = await Promise.all([
    db.friends.list(),
    db.chatMessages.list(),
    db.lineAccounts.list(),
  ]);
  const withMessage = new Set(messages.map((m) => m.friendId));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  return friends
    .filter((f) => !withMessage.has(f.id))
    .sort((a, b) => (a.registeredAt < b.registeredAt ? 1 : -1))
    .slice(0, limit)
    .map((f) => ({
      friendId: f.id,
      friendName: f.displayName,
      registeredAt: f.registeredAt,
      lineAccountName: accountName.get(f.lineAccountId),
    }));
}
