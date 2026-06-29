import { PLANS } from "@/config/plans";
import { getDataProvider } from "@/lib/data/provider";
import type { PlanCode } from "@/lib/data/types";

function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function envPlan(): PlanCode | undefined {
  const v = (process.env.LCALL_BILLING_PLAN ?? "").trim();
  return v in PLANS ? (v as PlanCode) : undefined;
}

/**
 * 申込時（納品前）にStripeで採番した顧客ID（env LCALL_BILLING_CUSTOMER_ID）を、
 * このインスタンスの BillingCustomer に引き継いで「支払い済みの契約」を確立する。
 * - 既に BillingCustomer があれば何もしない（冪等）。
 * - env が無い（通常デプロイ）なら何もしない。
 * /billing 表示前に一度呼ぶ。これで「納品前の支払い情報」と「システム内の契約情報」が
 * 同一 Stripe 顧客として紐づく。
 */
export async function ensurePrepaidBillingCustomer(): Promise<void> {
  const cus = (process.env.LCALL_BILLING_CUSTOMER_ID ?? "").trim();
  if (!cus) return;
  const db = getDataProvider();
  const existing = (await db.billingCustomers.list())[0];
  if (existing) return;

  const plan = envPlan();
  await db.billingCustomers.create({
    id: uid("bill"),
    stripeCustomerId: cus,
    plan: plan ?? "standard",
    status: "active",
    createdAt: new Date().toISOString(),
  });

  // 接続上限・機能ゲートに反映されるよう plan 設定も同期。
  if (plan) {
    const settings = await db.systemSettings.list();
    const s = settings.find((x) => x.key === "plan");
    if (s) await db.systemSettings.update(s.id, { value: plan });
    else await db.systemSettings.create({ id: uid("set"), key: "plan", value: plan });
  }
}
