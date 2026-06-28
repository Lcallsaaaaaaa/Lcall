import type { DataProvider } from "@/lib/data/repository";

/**
 * クリック計測時に、リダイレクトリンクに紐づく autoTagId を友だちへ自動付与する（§5/§7）。
 * F3 のクリック計測エンドポイントから呼ぶ想定。重複付与はしない。
 */
export async function applyAutoTagOnClick(
  db: DataProvider,
  redirectLinkId: string,
  friendId: string
): Promise<void> {
  const link = await db.redirectLinks.get(redirectLinkId);
  if (!link?.autoTagId) return;

  const existing = await db.friendTags.list();
  const dup = existing.some((ft) => ft.friendId === friendId && ft.tagId === link.autoTagId);
  if (dup) return;

  await db.friendTags.create({
    id: `ft_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    friendId,
    tagId: link.autoTagId,
    auto: true,
    createdAt: new Date().toISOString(),
  });
}
