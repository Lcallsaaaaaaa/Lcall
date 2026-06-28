"use server";

import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data/provider";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}

/** 画像を保管（当面はURL登録。本番のファイルアップロードは R2/Drive へ差し替え）。 */
export async function addMedia(formData: FormData) {
  const url = str(formData.get("url"));
  if (url) {
    await getDataProvider().mediaAssets.create({
      id: `med_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      name: str(formData.get("name")) || "無題の画像",
      url,
      createdAt: new Date().toISOString(),
    });
  }
  revalidatePath("/media");
}

export async function deleteMedia(id: string) {
  await getDataProvider().mediaAssets.remove(id);
  revalidatePath("/media");
}
