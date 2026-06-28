"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function uid(): string {
  return `chr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export async function createAiCharacter(formData: FormData) {
  const id = uid();
  await getDataProvider().aiCharacters.create({
    id,
    name: str(formData.get("name")) || "無題のキャラ",
    model: "claude-haiku-4-5",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/ai-characters");
  redirect(`/ai-characters/${id}`);
}

export async function updateAiCharacter(id: string, formData: FormData) {
  await getDataProvider().aiCharacters.update(id, {
    name: str(formData.get("name")) || "無題のキャラ",
    persona: str(formData.get("persona")) || undefined,
    faq: str(formData.get("faq")) || undefined,
    model: str(formData.get("model")) || undefined,
    avatarUrl: str(formData.get("avatarUrl")) || undefined,
  });
  revalidatePath("/ai-characters");
  revalidatePath(`/ai-characters/${id}`);
  redirect("/ai-characters");
}

/** 削除時は参照（アカウント/タグ/友だち）の割当も解除する。 */
export async function deleteAiCharacter(id: string) {
  const db = getDataProvider();
  const [accounts, tags, friends] = await Promise.all([
    db.lineAccounts.list(),
    db.tags.list(),
    db.friends.list(),
  ]);
  await Promise.all([
    ...accounts.filter((a) => a.aiCharacterId === id).map((a) => db.lineAccounts.update(a.id, { aiCharacterId: undefined })),
    ...tags.filter((t) => t.aiCharacterId === id).map((t) => db.tags.update(t.id, { aiCharacterId: undefined })),
    ...friends.filter((f) => f.aiCharacterId === id).map((f) => db.friends.update(f.id, { aiCharacterId: undefined })),
  ]);
  await db.aiCharacters.remove(id);
  revalidatePath("/ai-characters");
  redirect("/ai-characters");
}
