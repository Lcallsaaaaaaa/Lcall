/**
 * 実Stripe（テストモード）連携のビジネスロジック。
 * 商品/価格は lookup_key で「あれば再利用・無ければ作成」。
 * サブスク＝Checkout（月額＋初期費用）。AI従量＝invoice items で次回請求へ加算。
 */
import { PLANS, PRICING, planMonthlyFee } from "@/config/plans";
import type { PlanCode } from "@/lib/data/types";
import { stripe } from "@/lib/stripe";

const SETUP_LOOKUP = "lcall_setup";

async function findOrCreatePrice(
  lookupKey: string,
  productName: string,
  opts: { amount: number; recurring: boolean }
): Promise<string> {
  const found = await stripe("GET", "/prices", { lookup_keys: [lookupKey], active: true, limit: 1 });
  if (found.ok && Array.isArray(found.data?.data) && found.data.data.length > 0) {
    return found.data.data[0].id as string;
  }
  const product = await stripe("POST", "/products", { name: productName });
  if (!product.ok) throw new Error(`product作成失敗: ${product.error}`);
  const body: Record<string, unknown> = {
    unit_amount: opts.amount, // JPYはゼロ十進通貨：そのままの円額
    currency: "jpy",
    product: product.data.id,
    lookup_key: lookupKey,
  };
  if (opts.recurring) body.recurring = { interval: "month" };
  const price = await stripe("POST", "/prices", body);
  if (!price.ok) throw new Error(`price作成失敗: ${price.error}`);
  return price.data.id as string;
}

/** サブスク用 Checkout セッションを作成し、リダイレクト先URLを返す。 */
export async function createCheckoutSession(
  origin: string,
  plan: PlanCode
): Promise<{ url?: string; error?: string }> {
  try {
    const monthly = await findOrCreatePrice(`lcall_monthly_${plan}`, `LCall 月額（${PLANS[plan].name}）`, {
      amount: planMonthlyFee(plan),
      recurring: true,
    });
    const setup = await findOrCreatePrice(SETUP_LOOKUP, "LCall 初期導入サポート費", {
      amount: PRICING.setupFee,
      recurring: false,
    });
    const session = await stripe("POST", "/checkout/sessions", {
      mode: "subscription",
      line_items: [
        { price: monthly, quantity: 1 },
        { price: setup, quantity: 1 },
      ],
      success_url: `${origin}/billing?stripe=success`,
      cancel_url: `${origin}/billing?stripe=cancel`,
    });
    if (!session.ok) return { error: session.error };
    return { url: session.data.url as string };
  } catch (e) {
    return { error: String(e) };
  }
}

/** 顧客ポータル（支払い方法変更・解約）セッションを作成。 */
export async function createPortalSession(
  customerId: string,
  origin: string
): Promise<{ url?: string; error?: string }> {
  const session = await stripe("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: `${origin}/billing`,
  });
  if (!session.ok) return { error: session.error };
  return { url: session.data.url as string };
}

/** AI従量（件数×単価）を invoice item として計上＝次回サブスク請求に加算。 */
export async function reportAiUsageToStripe(
  customerId: string,
  count: number
): Promise<{ ok: boolean; amount: number; error?: string }> {
  if (count <= 0) return { ok: true, amount: 0 };
  const amount = count * PRICING.aiReplyUnitFee;
  const item = await stripe("POST", "/invoiceitems", {
    customer: customerId,
    amount,
    currency: "jpy",
    description: `AI自動応答 ${count}件 × ¥${PRICING.aiReplyUnitFee}`,
  });
  return item.ok ? { ok: true, amount } : { ok: false, amount, error: item.error };
}
