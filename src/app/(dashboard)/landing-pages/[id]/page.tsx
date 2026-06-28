import { ArrowLeft, ExternalLink, Link2, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { deleteLandingPage, updateLandingPage } from "@/features/landing-pages/actions";
import { getLandingPage } from "@/features/landing-pages/queries";
import { listForms } from "@/features/forms/queries";

export default async function LandingPageEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [page, forms, h] = await Promise.all([getLandingPage(id), listForms(), headers()]);
  if (!page) notFound();

  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicUrl = `${proto}://${host}/lp/${page.slug}`;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link href="/landing-pages" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        LP一覧へ
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">{page.title}</h1>

      <Card className="mb-5">
        <CardHeader title="公開LP" />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted" />
            <code className="truncate text-xs text-ink">{publicUrl}</code>
          </div>
          <a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer" className={buttonClasses("outline", "md")}>
            <ExternalLink className="size-4" />
            開く
          </a>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader title="内容" />
        <form action={updateLandingPage.bind(null, id)} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="LP名" htmlFor="title" required>
              <Input id="title" name="title" defaultValue={page.title} required />
            </FormField>
            <FormField label="スラッグ" htmlFor="slug" hint="公開URL /lp/◯◯">
              <Input id="slug" name="slug" defaultValue={page.slug} />
            </FormField>
          </div>
          <FormField label="説明文" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={page.description} />
          </FormField>
          <FormField label="画像URL" htmlFor="imageUrl">
            <Input id="imageUrl" name="imageUrl" defaultValue={page.imageUrl} placeholder="https://..." />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="CTAボタン文言" htmlFor="ctaLabel">
              <Input id="ctaLabel" name="ctaLabel" defaultValue={page.ctaLabel} placeholder="申し込む" />
            </FormField>
            <FormField label="連携フォーム" htmlFor="formId">
              <Select id="formId" name="formId" defaultValue={page.formId ?? ""}>
                <option value="">なし</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="決済リンク（任意）" htmlFor="paymentUrl" hint="Stripe Payment Link など">
            <Input id="paymentUrl" name="paymentUrl" defaultValue={page.paymentUrl} placeholder="https://buy.stripe.com/..." />
          </FormField>
          <FormField label="サンクスメッセージ" htmlFor="thanksMessage">
            <Input id="thanksMessage" name="thanksMessage" defaultValue={page.thanksMessage} />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" variant="gradient" size="md">
              保存
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="削除" description="このLPを削除します。" />
        <div className="p-5">
          <form action={deleteLandingPage.bind(null, id)}>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg">
              <Trash2 className="size-4" />
              このLPを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
