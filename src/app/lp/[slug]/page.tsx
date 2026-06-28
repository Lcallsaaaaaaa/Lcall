/* eslint-disable @next/next/no-img-element */
import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { getLandingPageBySlug } from "@/features/landing-pages/queries";

export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string; u?: string }>;
}) {
  const { slug } = await params;
  const { thanks, u } = await searchParams;
  const data = await getLandingPageBySlug(slug);
  if (!data) notFound();
  const { page, form } = data;

  // CTA の遷移先: フォーム連携 > 決済リンク
  const uQuery = u ? `?u=${encodeURIComponent(u)}` : "";
  const ctaHref = form
    ? `/f/${form.id}${uQuery}`
    : page.paymentUrl
      ? page.paymentUrl
      : `/lp/${slug}?thanks=1`;

  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <GradientLogo />
        </div>

        {thanks ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <CheckCircle2 className="mx-auto size-10 text-ok" />
            <h1 className="mt-3 text-xl font-semibold text-ink">完了しました</h1>
            <p className="mt-1 text-sm text-muted">{page.thanksMessage ?? "ありがとうございました。"}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {page.imageUrl && (
              <img src={page.imageUrl} alt="" className="h-48 w-full object-cover" />
            )}
            <div className="p-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{page.title}</h1>
              {page.description && (
                <p className="mx-auto mt-3 max-w-md whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {page.description}
                </p>
              )}
              <a href={ctaHref} className={buttonClasses("gradient", "lg", "mt-6 w-full")}>
                {page.ctaLabel ?? "申し込む"}
              </a>
              {page.paymentUrl && form && (
                <a href={page.paymentUrl} className="mt-3 block text-sm text-brand hover:underline">
                  決済へ進む
                </a>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-faint">Powered by LCall</p>
      </div>
    </main>
  );
}
