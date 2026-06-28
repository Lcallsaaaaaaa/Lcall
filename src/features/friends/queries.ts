import { getDataProvider } from "@/lib/data/provider";
import type { Friend, Tag } from "@/lib/data/types";

export interface FriendRow extends Friend {
  lineAccountName: string;
  tags: Tag[];
  formCount: number;
  surveyCount: number;
}

export interface FriendListParams {
  q?: string;
  tagId?: string;
  lineAccountId?: string;
  page?: number;
  pageSize?: number;
}

export interface FriendListResult {
  rows: FriendRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function countByFriend<T extends { friendId?: string }>(items: T[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (!it.friendId) continue;
    m.set(it.friendId, (m.get(it.friendId) ?? 0) + 1);
  }
  return m;
}

export async function listFriends(params: FriendListParams = {}): Promise<FriendListResult> {
  const db = getDataProvider();
  const [friends, accounts, tags, friendTags, formResponses, surveyResponses] = await Promise.all([
    db.friends.list(),
    db.lineAccounts.list(),
    db.tags.list(),
    db.friendTags.list(),
    db.formResponses.list(),
    db.surveyResponses.list(),
  ]);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const tagsByFriend = new Map<string, Tag[]>();
  for (const ft of friendTags) {
    const t = tagById.get(ft.tagId);
    if (!t) continue;
    const arr = tagsByFriend.get(ft.friendId) ?? [];
    arr.push(t);
    tagsByFriend.set(ft.friendId, arr);
  }
  const formByFriend = countByFriend(formResponses);
  const surveyByFriend = countByFriend(surveyResponses);

  let list: FriendRow[] = friends.map((f) => ({
    ...f,
    lineAccountName: accountName.get(f.lineAccountId) ?? f.lineAccountId,
    tags: tagsByFriend.get(f.id) ?? [],
    formCount: formByFriend.get(f.id) ?? 0,
    surveyCount: surveyByFriend.get(f.id) ?? 0,
  }));

  const q = params.q?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (f) => f.displayName.toLowerCase().includes(q) || f.lineUserId.toLowerCase().includes(q)
    );
  }
  if (params.tagId) list = list.filter((f) => f.tags.some((t) => t.id === params.tagId));
  if (params.lineAccountId) list = list.filter((f) => f.lineAccountId === params.lineAccountId);

  list.sort((a, b) => (a.registeredAt < b.registeredAt ? 1 : -1));

  const pageSize = params.pageSize ?? 20;
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);
  const start = (page - 1) * pageSize;
  return { rows: list.slice(start, start + pageSize), total, page, pageSize, pageCount };
}

export interface FriendTagRef {
  friendTagId: string;
  tag: Tag;
  auto: boolean;
}

export interface FriendFormHistory {
  id: string;
  formTitle: string;
  createdAt: string;
}

export interface FriendSurveyHistory {
  id: string;
  surveyTitle: string;
  createdAt: string;
}

export interface FriendDetail {
  friend: Friend;
  lineAccountName: string;
  tags: FriendTagRef[];
  formHistory: FriendFormHistory[];
  surveyHistory: FriendSurveyHistory[];
}

export async function getFriendDetail(id: string): Promise<FriendDetail | null> {
  const db = getDataProvider();
  const friend = await db.friends.get(id);
  if (!friend) return null;

  const [accounts, tags, friendTags, forms, formResponses, surveys, surveyResponses] =
    await Promise.all([
      db.lineAccounts.list(),
      db.tags.list(),
      db.friendTags.list(),
      db.forms.list(),
      db.formResponses.list(),
      db.surveys.list(),
      db.surveyResponses.list(),
    ]);

  const tagById = new Map(tags.map((t) => [t.id, t]));
  const formTitle = new Map(forms.map((f) => [f.id, f.title]));
  const surveyTitle = new Map(surveys.map((s) => [s.id, s.title]));

  const friendTagRefs: FriendTagRef[] = friendTags
    .filter((ft) => ft.friendId === id)
    .map((ft) => ({ friendTagId: ft.id, tag: tagById.get(ft.tagId)!, auto: ft.auto }))
    .filter((r) => r.tag);

  return {
    friend,
    lineAccountName: accounts.find((a) => a.id === friend.lineAccountId)?.name ?? friend.lineAccountId,
    tags: friendTagRefs,
    formHistory: formResponses
      .filter((r) => r.friendId === id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => ({ id: r.id, formTitle: formTitle.get(r.formId) ?? r.formId, createdAt: r.createdAt })),
    surveyHistory: surveyResponses
      .filter((r) => r.friendId === id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => ({
        id: r.id,
        surveyTitle: surveyTitle.get(r.surveyId) ?? r.surveyId,
        createdAt: r.createdAt,
      })),
  };
}
