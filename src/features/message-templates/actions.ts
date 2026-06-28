"use server";

import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data/provider";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}

export async function createMessageTemplate(formData: FormData) {
  const text = str(formData.get("text"));
  if (text) {
    await getDataProvider().messageTemplates.create({
      id: `mt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      title: str(formData.get("title")) || "無題の定型文",
      text,
      createdAt: new Date().toISOString(),
    });
  }
  revalidatePath("/message-templates");
  revalidatePath("/inbox");
}

export async function updateMessageTemplate(id: string, formData: FormData) {
  const text = str(formData.get("text"));
  await getDataProvider().messageTemplates.update(id, {
    title: str(formData.get("title")) || "無題の定型文",
    text,
  });
  revalidatePath("/message-templates");
  revalidatePath("/inbox");
}

export async function deleteMessageTemplate(id: string) {
  await getDataProvider().messageTemplates.remove(id);
  revalidatePath("/message-templates");
  revalidatePath("/inbox");
}
