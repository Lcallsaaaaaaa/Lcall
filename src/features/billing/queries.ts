import { PLANS, PRICING, type PlanDef } from "@/config/plans";
import { getDataProvider } from "@/lib/data/provider";
import type { BillingCustomer, ChatMessage, Invoice, PlanCode } from "@/lib/data/types";
import { stripeEnabled, isStripeTestKey } from "@/lib/stripe";

/** 指定日時以降に送信した AI自動応答の件数（従量課金の対象）。 */
export function countAiReplies(messages: ChatMessage[], sinceIso: string): number {
  return messages.filter((m) => m.ai && m.createdAt > sinceIso).length;
}

export interface BillingView {
  customer: BillingCustomer | null;
  planDef: PlanDef | null;
  invoices: Invoice[];
  /** past_due 時の配信停止予定日（支払い失敗+14日） */
  suspendAt?: string;
  /** past_due 時のデータ削除対象日（支払い失敗+30日） */
  purgeAt?: string;
  /** 月次経常収益（active のとき月額） */
  mrr: number;
  paidTotal: number;
  /** 今月（暦月）のAI自動応答件数 */
  aiReplies: number;
  /** プランに含まれる月間無料AI枠 */
  aiMonthlyLimit: number;
  /** 購入残高（繰り越し・無料枠超過分に使用） */
  aiCredits: number;
  /** AI従量の金額（プランに含むため常に0） */
  aiUsageAmount: number;
  /** 次回請求の見込み額（月額のみ・AIは含む） */
  nextInvoiceEstimate: number;
  /** 実Stripe連携が有効か */
  stripe: boolean;
  /** Stripeがテストモードのキーか */
  stripeTest: boolean;
  /** 実Stripeの顧客として確立済みか（モック/シードのcus_demo等は未確立） */
  stripeOnboarded: boolean;
  /** 未計上（実Stripe未計上）のAI応対件数 */
  aiUnbilled: number;
  /** 未計上のAI従量金額 */
  aiUnbilledAmount: number;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function getBilling(): Promise<BillingView> {
  const db = getDataProvider();
  const [customers, allInvoices, chatMessages, settings] = await Promise.all([
    db.billingCustomers.list(),
    db.invoices.list(),
    db.chatMessages.list(),
    db.systemSettings.list(),
  ]);
  const customer = customers[0] ?? null;

  const invoices = allInvoices
    .filter((i) => !customer || i.billingCustomerId === customer.id)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));

  const monthly = customer ? PLANS[customer.plan].monthlyFee : 0;
  // AIはプランに含む（従量請求しない）。今月（暦月）のAI応答回数と月間上限を表示に使う。
  const planKey = settings.find((s) => s.key === "plan")?.value;
  const plan: PlanCode =
    planKey === "lite" || planKey === "standard" || planKey === "pro" ? planKey : (customer?.plan ?? "standard");
  const aiMonthlyLimit = PLANS[plan].aiMonthlyLimit;
  const aiCredits = Math.max(0, parseInt(settings.find((s) => s.key === "aiCredits")?.value ?? "0", 10) || 0);
  const ym = new Date().toISOString().slice(0, 7);
  const aiReplies = chatMessages.filter((m) => m.ai && (m.createdAt ?? "").slice(0, 7) === ym).length;

  const view: BillingView = {
    customer,
    planDef: customer ? PLANS[customer.plan] : null,
    invoices,
    mrr: customer && customer.status === "active" ? monthly : 0,
    paidTotal: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0),
    aiReplies,
    aiMonthlyLimit,
    aiCredits,
    aiUsageAmount: 0, // プランに含む＝従量請求なし
    nextInvoiceEstimate: monthly, // AIは含むため月額のみ
    stripe: stripeEnabled(),
    stripeTest: isStripeTestKey(),
    stripeOnboarded:
      stripeEnabled() &&
      !!customer?.stripeCustomerId &&
      customer.stripeCustomerId.startsWith("cus_") &&
      !customer.stripeCustomerId.startsWith("cus_mock") &&
      customer.stripeCustomerId !== "cus_demo",
    aiUnbilled: 0,
    aiUnbilledAmount: 0,
  };

  if (customer?.paymentFailedAt) {
    view.suspendAt = addDays(customer.paymentFailedAt, PRICING.suspendAfterDays);
    view.purgeAt = addDays(customer.paymentFailedAt, PRICING.purgeAfterDays);
  }
  return view;
}
