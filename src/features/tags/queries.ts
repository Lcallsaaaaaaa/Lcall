import { getDataProvider } from "@/lib/data/provider";
import type { Tag } from "@/lib/data/types";

export interface TagWithMeta extends Tag {
  /** このタグが付与されている顧客数 */
  friendCount: number;
  /** クリック時の自動付与に使われているタグか（redirect_links.autoTagId 由来） */
  auto: boolean;
}

export async function listTags(): Promise<Tag[]> {
  return (await getDataProvider().tags.list()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1
  );
}

export async function getTag(id: string): Promise<Tag | null> {
  return getDataProvider().tags.get(id);
}

export async function getTagFriendCounts(): Promise<Map<string, number>> {
  const fts = await getDataProvider().friendTags.list();
  const m = new Map<string, number>();
  for (const ft of fts) m.set(ft.tagId, (m.get(ft.tagId) ?? 0) + 1);
  return m;
}

/** 自動付与に使われているタグID（クリック計測の autoTagId）。 */
export async function getAutoTagIds(): Promise<Set<string>> {
  const links = await getDataProvider().redirectLinks.list();
  const s = new Set<string>();
  for (const l of links) if (l.autoTagId) s.add(l.autoTagId);
  return s;
}

export async function listTagsWithMeta(): Promise<TagWithMeta[]> {
  const [tags, counts, autoIds] = await Promise.all([
    listTags(),
    getTagFriendCounts(),
    getAutoTagIds(),
  ]);
  return tags.map((t) => ({
    ...t,
    friendCount: counts.get(t.id) ?? 0,
    auto: autoIds.has(t.id),
  }));
}
