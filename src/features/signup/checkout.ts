import { PLANS } from "@/config/plans";
import type { ClientAccount } from "@/lib/data/types";
import { stripe, stripeEnabled } from "@/lib/stripe";

/**
 * 申込（システム料）の Stripe Checkout（サブスクリプション）を作成し、決済URLを返す。
 *
 * - 開発者の env Stripe（STRIPE_SECRET_KEY）で作成。価格は config/plans の月額を inline price_data で指定
 *   （事前の Price 作成不要・通貨 JPY）。
 * - client_reference_id / metadata に clientAccountId を載せ、webhook（コントロールプレーン）が
 *   採番された顧客ID（cus_…）を台帳の ClientAccount に紐づける＝申込時の支払い情報とシステム情報の連結。
 * - Stripe 未設定、または公開URL未設定なら null（呼び出し側はトライアルのまま完了画面へ）。
 */
export async function createSignupCheckoutUrl(client: ClientAccount): Promise<string | null> {
  if (!stripeEnabled()) return null;
  const base = (process.env.LCALL_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (!base) return null; // success/cancel は絶対URL必須

  const plan = PLANS[client.plan];
  const res = await stripe("POST", "/checkout/sessions", {
    mode: "subscription",
    client_reference_id: client.id,
    customer_email: client.contactEmail || undefined,
    metadata: { kind: "system_subscription", clientAccountId: client.id, slug: client.slug },
    subscription_data: { metadata: { clientAccountId: client.id, slug: client.slug } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: plan.monthlyFee,
          recurring: { interval: "month" },
          product_data: { name: `LCall ${plan.name} プラン（月額）` },
        },
      },
    ],
    success_url: `${base}/signup/done?ca=${client.id}`,
    cancel_url: `${base}/signup?canceled=1`,
  });

  if (!res.ok || !res.data?.url) return null;
  return String(res.data.url);
}
