"use server";

import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data/provider";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `ad${Math.floor(Math.random() * 1e5)}`
  );
}

export async function createAdCode(formData: FormData) {
  const db = getDataProvider();
  const label = str(formData.get("label")) || "無題の広告";
  const raw = str(formData.get("code")) || label;
  let code = slugify(raw);
  // コード重複を避ける
  const existing = new Set((await db.adCodes.list()).map((a) => a.code));
  if (existing.has(code)) code = `${code}-${Math.floor(Math.random() * 1000)}`;

  await db.adCodes.create({
    id: `ad_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    code,
    label,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/ad-codes");
}

export async function deleteAdCode(id: string) {
  await getDataProvider().adCodes.remove(id);
  revalidatePath("/ad-codes");
}
