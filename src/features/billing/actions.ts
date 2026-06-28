"use server";

import { PRICING, planMonthlyFee } from "@/config/plans";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import type { BillingCustomer, Invoice, PlanCode } from "@/lib/data/types";
import { stripeEnabled } from "@/lib/stripe";
import { publicBaseUrl } from "@/lib/url";
import { countAiReplies } from "./queries";
import { createCheckoutSession, createPortalSession, reportAiUsageToStripe } from "./stripe";

async function getOrigin(): Promise<string> {
  return publicBaseUrl();
}

function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function parsePlan(v: FormDataEntryValue | null): PlanCode {
  const s = String(v ?? "");
  return s === "lite" || s === "standard" || s === "pro" ? s : "standard";
}
function addMonths(date: Date, n: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

async function getCustomer(): Promise<BillingCustomer | null> {
  return (await getDataProvider().billingCustomers.list())[0] ?? null;
}

async function addInvoice(billingCustomerId: string, kind: Invoice["kind"], amount: number, status: Invoice["status"]) {
  await getDataProvider().invoices.create({
    id: uid("inv"),
    billingCustomerId,
    kind,
    amount,
    status,
    issuedAt: new Date().toISOString(),
  });
}

/** システム設定の plan も同期（LINE接続上限などに反映）。 */
async function syncPlanSetting(plan: PlanCode) {
  const db = getDataProvider();
  const settings = await db.systemSettings.list();
  const s = settings.find((x) => x.key === "plan");
  if (s) await db.systemSettings.update(s.id, { value: plan });
  else await db.systemSettings.create({ id: uid("set"), key: "plan", value: plan });
}

function revalidate() {
  revalidatePath("/billing");
  revalidatePath("/line-accounts");
  revalidatePath("/");
}

/** プラン申込。実Stripe有効時は Checkout へリダイレクト、未設定時はモック即時請求。 */
export async function subscribePlan(formData: FormData) {
  const plan = parsePlan(formData.get("plan"));

  // ---- 実Stripe（テスト/本番）: Checkout セッションへ ----
  if (stripeEnabled()) {
    await syncPlanSetting(plan); // 接続上限などに反映（webhookで顧客作成時に参照）
    const { url, error } = await createCheckoutSession(await getOrigin(), plan);
    if (url) redirect(url);
    redirect(`/billing?stripe=error&msg=${encodeURIComponent(error ?? "Checkout作成に失敗")}`);
  }

  // ---- モック（STRIPE_SECRET_KEY 未設定時） ----
  const db = getDataProvider();
  let customer = await getCustomer();
  const now = new Date();

  if (!customer) {
    customer = {
      id: uid("bill"),
      stripeCustomerId: `cus_mock_${Math.floor(Math.random() * 1e6)}`,
      plan,
      status: "active",
      nextBillingAt: addMonths(now, 1),
      createdAt: now.toISOString(),
    };
    await db.billingCustomers.create(customer);
    await addInvoice(customer.id, "setup", PRICING.setupFee, "paid");
  } else {
    await db.billingCustomers.update(customer.id, {
      plan,
      status: "active",
      nextBillingAt: addMonths(now, 1),
      paymentFailedAt: undefined,
    });
  }
  await addInvoice(customer.id, "monthly", planMonthlyFee(plan), "paid");
  await syncPlanSetting(plan);
  revalidate();
}

export async function changePlan(formData: FormData) {
  const customer = await getCustomer();
  if (!customer) return;
  const plan = parsePlan(formData.get("plan"));
  await getDataProvider().billingCustomers.update(customer.id, { plan });
  await syncPlanSetting(plan);
  revalidate();
}

/** 月額課金をシミュレート（成功）。月額＋AI自動応答の従量（前回月次請求以降）を合算。 */
export async function chargeMonthly() {
  const customer = await getCustomer();
  if (!customer) return;
  const db = getDataProvider();
  const [invoices, messages] = await Promise.all([db.invoices.list(), db.chatMessages.list()]);
  const lastMonthly = invoices
    .filter((i) => i.billingCustomerId === customer.id && i.kind === "monthly")
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))[0];
  const since = lastMonthly?.issuedAt ?? customer.createdAt;
  const aiUsage = countAiReplies(messages, since) * PRICING.aiReplyUnitFee;

  await db.billingCustomers.update(customer.id, {
    status: "active",
    nextBillingAt: addMonths(new Date(), 1),
    paymentFailedAt: undefined,
  });
  await addInvoice(customer.id, "monthly", planMonthlyFee(customer.plan) + aiUsage, "paid");
  revalidate();
}

/** 支払い失敗をシミュレート（→14日後配信停止 / 30日後データ削除対象）。 */
export async function simulatePaymentFailure() {
  const customer = await getCustomer();
  if (!customer) return;
  await getDataProvider().billingCustomers.update(customer.id, {
    status: "past_due",
    paymentFailedAt: new Date().toISOString(),
  });
  await addInvoice(customer.id, "monthly", planMonthlyFee(customer.plan), "failed");
  revalidate();
}

/** 支払い復旧。 */
export async function recoverPayment() {
  const customer = await getCustomer();
  if (!customer) return;
  await getDataProvider().billingCustomers.update(customer.id, {
    status: "active",
    nextBillingAt: addMonths(new Date(), 1),
    paymentFailedAt: undefined,
  });
  await addInvoice(customer.id, "monthly", planMonthlyFee(customer.plan), "paid");
  revalidate();
}

export async function cancelSubscription() {
  const customer = await getCustomer();
  if (!customer) return;
  await getDataProvider().billingCustomers.update(customer.id, { status: "canceled", nextBillingAt: undefined });
  revalidate();
}

/** 実Stripe: 顧客ポータル（支払い方法変更・解約）へリダイレクト。 */
export async function openBillingPortal() {
  const customer = await getCustomer();
  if (!stripeEnabled() || !customer?.stripeCustomerId) return;
  const { url, error } = await createPortalSession(customer.stripeCustomerId, await getOrigin());
  if (url) redirect(url);
  redirect(`/billing?stripe=error&msg=${encodeURIComponent(error ?? "ポータル作成に失敗")}`);
}

/** 実Stripe: 未計上のAI応対（ai && !aiBilled）を invoice item として計上し、計上済みに印を付ける。 */
export async function reportAiUsage() {
  const customer = await getCustomer();
  if (!stripeEnabled() || !customer?.stripeCustomerId) return;
  const db = getDataProvider();
  const unbilled = (await db.chatMessages.list()).filter((m) => m.ai && !m.aiBilled);
  if (unbilled.length > 0) {
    const res = await reportAiUsageToStripe(customer.stripeCustomerId, unbilled.length);
    if (res.ok) {
      await Promise.all(unbilled.map((m) => db.chatMessages.update(m.id, { aiBilled: true })));
    }
  }
  revalidate();
}
