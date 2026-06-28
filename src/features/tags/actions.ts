"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}

function revalidateTagViews() {
  revalidatePath("/tags");
  revalidatePath("/friends");
}

export async function createTag(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) redirect("/tags?error=name");
  const color = str(formData.get("color")) || "#dd2a7b";
  await getDataProvider().tags.create({
    id: `tg_${Date.now()}`,
    name,
    color,
    createdAt: new Date().toISOString(),
  });
  revalidateTagViews();
  redirect("/tags");
}

export async function updateTag(id: string, formData: FormData) {
  await getDataProvider().tags.update(id, {
    name: str(formData.get("name")) || "タグ",
    color: str(formData.get("color")) || "#dd2a7b",
    aiCharacterId: str(formData.get("aiCharacterId")) || undefined,
  });
  revalidateTagViews();
  redirect("/tags");
}

export async function deleteTag(id: string) {
  const db = getDataProvider();
  await db.tags.remove(id);
  // 関連する friend_tags をカスケード削除
  const fts = await db.friendTags.list();
  await Promise.all(fts.filter((ft) => ft.tagId === id).map((ft) => db.friendTags.remove(ft.id)));
  revalidateTagViews();
  redirect("/tags");
}

/** 顧客へタグを手動付与。 */
export async function assignTag(friendId: string, formData: FormData) {
  const tagId = str(formData.get("tagId"));
  if (tagId) {
    const db = getDataProvider();
    const existing = await db.friendTags.list();
    const dup = existing.some((ft) => ft.friendId === friendId && ft.tagId === tagId);
    if (!dup) {
      await db.friendTags.create({
        id: `ft_${Date.now()}`,
        friendId,
        tagId,
        auto: false,
        createdAt: new Date().toISOString(),
      });
    }
  }
  revalidatePath(`/friends/${friendId}`);
  revalidatePath("/friends");
  revalidatePath("/tags");
  revalidatePath("/inbox");
}

/** 顧客からタグを解除。 */
export async function unassignTag(friendTagId: string, friendId: string) {
  await getDataProvider().friendTags.remove(friendTagId);
  revalidatePath(`/friends/${friendId}`);
  revalidatePath("/friends");
  revalidatePath("/tags");
  revalidatePath("/inbox");
}
