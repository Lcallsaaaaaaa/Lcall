import { PLANS, PRICING, type PlanDef } from "@/config/plans";
import { getDataProvider } from "@/lib/data/provider";
import type { BillingCustomer, ChatMessage, Invoice } from "@/lib/data/types";
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
  /** 当期（前回の月次請求以降）のAI自動応答件数 */
  aiReplies: number;
  /** AI従量の金額（aiReplies × 単価） */
  aiUsageAmount: number;
  /** 次回請求の見込み額（月額＋AI従量） */
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
  const [customers, allInvoices, chatMessages] = await Promise.all([
    db.billingCustomers.list(),
    db.invoices.list(),
    db.chatMessages.list(),
  ]);
  const customer = customers[0] ?? null;

  const invoices = allInvoices
    .filter((i) => !customer || i.billingCustomerId === customer.id)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));

  // 前回の月次請求以降の AI 応対を当期の従量として集計
  const lastMonthly = invoices.find((i) => i.kind === "monthly");
  const since = lastMonthly?.issuedAt ?? customer?.createdAt ?? "1970-01-01T00:00:00.000Z";
  const aiReplies = countAiReplies(chatMessages, since);
  const aiUsageAmount = aiReplies * PRICING.aiReplyUnitFee;
  const aiUnbilled = chatMessages.filter((m) => m.ai && !m.aiBilled).length;
  const monthly = customer ? PLANS[customer.plan].monthlyFee : 0;

  const view: BillingView = {
    customer,
    planDef: customer ? PLANS[customer.plan] : null,
    invoices,
    mrr: customer && customer.status === "active" ? monthly : 0,
    paidTotal: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0),
    aiReplies,
    aiUsageAmount,
    nextInvoiceEstimate: customer ? monthly + aiUsageAmount : 0,
    stripe: stripeEnabled(),
    stripeTest: isStripeTestKey(),
    stripeOnboarded:
      stripeEnabled() &&
      !!customer?.stripeCustomerId &&
      customer.stripeCustomerId.startsWith("cus_") &&
      !customer.stripeCustomerId.startsWith("cus_mock") &&
      customer.stripeCustomerId !== "cus_demo",
    aiUnbilled,
    aiUnbilledAmount: aiUnbilled * PRICING.aiReplyUnitFee,
  };

  if (customer?.paymentFailedAt) {
    view.suspendAt = addDays(customer.paymentFailedAt, PRICING.suspendAfterDays);
    view.purgeAt = addDays(customer.paymentFailedAt, PRICING.purgeAfterDays);
  }
  return view;
}
