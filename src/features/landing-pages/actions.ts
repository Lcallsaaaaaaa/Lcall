"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `lp-${Math.floor(Math.random() * 1e6)}`;
}

export async function createLandingPage(formData: FormData) {
  const id = uid("lp");
  const title = str(formData.get("title")) || "無題のLP";
  await getDataProvider().landingPages.create({
    id,
    slug: `${slugify(title)}-${Math.floor(Math.random() * 1000)}`,
    title,
    ctaLabel: "申し込む",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/landing-pages");
  redirect(`/landing-pages/${id}`);
}

export async function updateLandingPage(id: string, formData: FormData) {
  await getDataProvider().landingPages.update(id, {
    slug: slugify(str(formData.get("slug"))),
    title: str(formData.get("title")) || "無題のLP",
    description: str(formData.get("description")) || undefined,
    imageUrl: str(formData.get("imageUrl")) || undefined,
    ctaLabel: str(formData.get("ctaLabel")) || "申し込む",
    formId: str(formData.get("formId")) || undefined,
    paymentUrl: str(formData.get("paymentUrl")) || undefined,
    thanksMessage: str(formData.get("thanksMessage")) || undefined,
  });
  revalidatePath(`/landing-pages/${id}`);
  revalidatePath("/landing-pages");
  redirect(`/landing-pages/${id}`);
}

export async function deleteLandingPage(id: string) {
  await getDataProvider().landingPages.remove(id);
  revalidatePath("/landing-pages");
  redirect("/landing-pages");
}
