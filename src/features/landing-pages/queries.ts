import { getDataProvider } from "@/lib/data/provider";
import type { Form, LandingPage } from "@/lib/data/types";

export interface LandingPageRow extends LandingPage {
  formTitle?: string;
}

export async function listLandingPages(): Promise<LandingPageRow[]> {
  const db = getDataProvider();
  const [pages, forms] = await Promise.all([db.landingPages.list(), db.forms.list()]);
  const formTitle = new Map(forms.map((f) => [f.id, f.title]));
  return pages
    .map((p) => ({ ...p, formTitle: p.formId ? formTitle.get(p.formId) : undefined }))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function getLandingPage(id: string): Promise<LandingPage | null> {
  return getDataProvider().landingPages.get(id);
}

export async function getLandingPageBySlug(
  slug: string
): Promise<{ page: LandingPage; form: Form | null } | null> {
  const db = getDataProvider();
  const pages = await db.landingPages.list();
  const page = pages.find((p) => p.slug === slug);
  if (!page) return null;
  const form = page.formId ? await db.forms.get(page.formId) : null;
  return { page, form };
}
