import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Form";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { PLANS, PRICING } from "@/config/plans";
import { submitSignup } from "@/features/signup/actions";
import { isControlPlane } from "@/lib/operator";
import { stripeEnabled } from "@/lib/stripe";

// env / searchParams を毎回評価（ビルド時に固定しない）
export const dynamic = "force-dynamic";

function baseDomain(): string {
  return (process.env.LCALL_TENANT_BASE_DOMAIN || "").trim().toLowerCase() || "lcall.shop";
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    err?: string;
    name?: string;
    slug?: string;
    contactEmail?: string;
    plan?: string;
    aff?: string;
    setup?: string;
    canceled?: string;
  }>;
}) {
  // テナントアプリ（クライアント側）では申込を出さない。コントロールプレーン（HP）専用。
  if (!isControlPlane()) notFound();

  const sp = await searchParams;
  const domain = baseDomain();
  const planDefault = sp.plan === "lite" || sp.plan === "standard" || sp.plan === "pro" ? sp.plan : "standard";
  const willCharge = stripeEnabled();

  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <GradientLogo />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">LCall をはじめる</h1>
          <p className="mt-1 text-sm text-muted">
            お申し込み後、あなた専用のシステム（<span className="font-medium text-ink">○○.{domain}</span>）が自動で発行されます。
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {sp.canceled && (
            <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
              お支払いはキャンセルされました。内容を確認して、もう一度お進みください。
            </p>
          )}
          {sp.err && (
            <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{sp.err}</p>
          )}
          {!willCharge && (
            <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
              ただいまお申し込みの準備中です（決済設定の反映待ち）。少し時間をおいて再度お試しください。
            </p>
          )}

          <form action={submitSignup} className="space-y-4">
            {sp.aff && <input type="hidden" name="aff" value={sp.aff} />}

            <FormField label="事業者名・店舗名" htmlFor="name" required>
              <Input id="name" name="name" defaultValue={sp.name ?? ""} placeholder="例：サロン アクメ" required />
            </FormField>

            <FormField
              label="希望のサブドメイン"
              htmlFor="slug"
              required
              hint={`あなたの管理画面URLになります（英小文字・数字・ハイフン／3〜30文字）`}
            >
              <div className="flex items-stretch overflow-hidden rounded-lg border border-line-strong focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <input
                  id="slug"
                  name="slug"
                  defaultValue={sp.slug ?? ""}
                  placeholder="acme"
                  required
                  className="h-10 w-full bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint"
                />
                <span className="flex items-center bg-surface-2 px-3 text-sm text-muted">.{domain}</span>
              </div>
            </FormField>

            <FormField label="連絡先メール（ログインID）" htmlFor="contactEmail" required>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={sp.contactEmail ?? ""}
                placeholder="owner@example.com"
                required
              />
            </FormField>

            <FormField label="ログインパスワード" htmlFor="password" required hint="8文字以上。発行後すぐログインに使います">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="••••••••"
                required
              />
            </FormField>

            <FormField label="プラン" htmlFor="plan" required>
              <Select id="plan" name="plan" defaultValue={planDefault}>
                {Object.values(PLANS).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}（¥{p.monthlyFee.toLocaleString()}/月・税込／LINE {p.lineLimit}接続）
                  </option>
                ))}
              </Select>
            </FormField>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 px-3 py-3">
              <input
                type="checkbox"
                name="setup"
                value="1"
                defaultChecked={sp.setup === "1"}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span className="text-sm text-ink">
                <span className="font-medium">
                  初期設定サポート（¥{PRICING.setupFee.toLocaleString()}・初回のみ）を追加
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  LINE連携・シナリオ（ステップ配信）・AI初期設定などをまるごと代行。ご希望の場合のみ、初回のお支払いに一度だけ加算されます。
                </span>
              </span>
            </label>

            <button type="submit" disabled={!willCharge} className={buttonClasses("gradient", "lg", "w-full")}>
              申し込んでお支払いへ進む
            </button>
            <p className="text-center text-xs text-faint">
              次の画面（Stripe）でカード情報を登録し、月額サブスクリプションを開始します。決済の確定後にシステムが発行されます。
            </p>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          すでにアカウントをお持ちですか？ 各システムの「○○.{domain}/login」からログインしてください。
        </p>
      </div>
    </main>
  );
}
