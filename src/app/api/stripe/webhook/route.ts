import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data/provider";
import type { DataProvider } from "@/lib/data/repository";
import type { BillingCustomer, Invoice, PlanCode } from "@/lib/data/types";
import { finalizeReservationConfirmed } from "@/features/reservations/finalize";
import { accrueRecurringForClient, ensureSignupCommission } from "@/features/operator/affiliate";
import { provisionTenant } from "@/features/operator/provision";
import { isControlPlane } from "@/lib/operator";
import { stripe, verifyStripeSignature } from "@/lib/stripe";

/**
 * 運営コンソール（コントロールプレーン）でのシステム料Webhook処理。
 * 開発者の単一env Stripe からの請求イベントを、stripeCustomerId で ClientAccount に振り分けて
 * 台帳のステータス更新＋月次レベニューシェアの計上を行う（社数が増えても1箇所で集約）。
 */
async function handleControlPlaneBilling(db: DataProvider, type: string, obj: any): Promise<void> {
  const cus = obj?.customer ? String(obj.customer) : "";
  // 顧客IDで台帳を引く。未紐づけ（申込Checkout初回）は client_reference_id / metadata で引き当て、
  // 採番された顧客IDを台帳へ書き込む＝申込時の支払い情報とシステム情報の連結。
  const accounts = await db.clientAccounts.list();
  let client = cus ? accounts.find((c) => c.stripeCustomerId === cus) : undefined;
  if (!client) {
    const ref = String(
      obj?.client_reference_id ??
        obj?.metadata?.clientAccountId ??
        obj?.subscription_details?.metadata?.clientAccountId ??
        ""
    );
    if (ref) client = accounts.find((c) => c.id === ref);
  }
  if (!client) return;

  function periodMonth(): string {
    const sec = Number(obj?.lines?.data?.[0]?.period?.end ?? obj?.period?.end);
    const d = Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  switch (type) {
    case "checkout.session.completed":
      await db.clientAccounts.update(client.id, {
        status: "active",
        // 顧客IDが未登録（申込Checkout）なら採番値を保存。以後 invoice 系はこれで引ける。
        ...(cus && !client.stripeCustomerId ? { stripeCustomerId: cus } : {}),
      });
      // 決済確定＝ここで初めて専用DBを作成・開通（申込時に保存したオーナー名/PWハッシュで初期オーナー作成）。
      await provisionTenant({ clientAccountId: client.id });
      await ensureSignupCommission(client.id); // 初回報酬（紹介経由のみ・冪等）
      break;
    case "invoice.paid":
      await db.clientAccounts.update(client.id, { status: "active" });
      await accrueRecurringForClient(client.id, periodMonth()); // 月次レベニューシェア
      break;
    case "customer.subscription.deleted":
      await db.clientAccounts.update(client.id, { status: "canceled" });
      break;
    default:
      break;
  }
}

export const runtime = "nodejs";

function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function isoFromUnix(sec: unknown): string | undefined {
  const n = Number(sec);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : undefined;
}

/**
 * Stripe Webhook（テスト/本番共通）。署名検証 → 単一テナントの BillingCustomer に反映。
 * LINE Developers ではなく Stripe ダッシュボード／CLI でこのURLを Webhook 登録する。
 */
export async function POST(request: Request) {
  const db = getDataProvider();
  // クライアント自身のWebhookシークレット（決済設定・予約決済用）と env（システム料billing用）の両方で検証
  const clientSecret = (await db.systemSettings.list()).find((s) => s.key === "stripe_webhook_secret")?.value?.trim();
  const envSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!clientSecret && !envSecret) return new Response("Webhookシークレット未設定", { status: 500 });

  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  const verified =
    (clientSecret && verifyStripeSignature(raw, sig, clientSecret)) ||
    (envSecret && verifyStripeSignature(raw, sig, envSecret));
  if (!verified) {
    return new Response("invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const obj = event?.data?.object ?? {};

  // 運営コンソールでは、システム料の請求イベントを stripeCustomerId で ClientAccount に集約処理。
  if (isControlPlane()) {
    await handleControlPlaneBilling(db, String(event.type), obj);
    revalidatePath("/operator");
    revalidatePath("/operator/affiliates");
    return new Response("ok");
  }

  async function getOrCreateCustomer(stripeCustomerId?: string): Promise<BillingCustomer> {
    const list = await db.billingCustomers.list();
    let customer = list[0] ?? null;
    if (!customer) {
      const planSetting = (await db.systemSettings.list()).find((s) => s.key === "plan")?.value;
      const plan: PlanCode =
        planSetting === "lite" || planSetting === "standard" || planSetting === "pro" ? planSetting : "standard";
      customer = {
        id: uid("bill"),
        stripeCustomerId: stripeCustomerId ?? "",
        plan,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      await db.billingCustomers.create(customer);
    }
    return customer;
  }

  async function addInvoice(billingCustomerId: string, kind: Invoice["kind"], amount: number, status: Invoice["status"]) {
    await db.invoices.create({
      id: uid("inv"),
      billingCustomerId,
      kind,
      amount,
      status,
      issuedAt: new Date().toISOString(),
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      // 予約の事前支払いはここで確定（メタデータ kind=reservation）。サブスク請求とは分岐。
      if (obj.metadata?.kind === "reservation") {
        const rid = String(obj.metadata?.reservationId || obj.client_reference_id || "");
        const r = rid ? await db.reservations.get(rid) : null;
        if (r && r.status !== "cancelled") {
          await db.reservations.update(r.id, {
            status: "confirmed",
            paymentStatus: "paid",
            stripePaymentIntentId: obj.payment_intent ? String(obj.payment_intent) : r.stripePaymentIntentId,
          });
          await finalizeReservationConfirmed(db, r.id);
          revalidatePath(`/reservations/${r.reservationPageId}`);
        }
        break;
      }
      const customer = await getOrCreateCustomer(obj.customer);
      let nextBillingAt: string | undefined;
      if (obj.subscription) {
        const sub = await stripe("GET", `/subscriptions/${obj.subscription}`);
        nextBillingAt = isoFromUnix(sub.data?.current_period_end);
      }
      await db.billingCustomers.update(customer.id, {
        stripeCustomerId: obj.customer ?? customer.stripeCustomerId,
        stripeSubscriptionId: obj.subscription ?? customer.stripeSubscriptionId,
        status: "active",
        nextBillingAt,
        paymentFailedAt: undefined,
      });
      break;
    }
    case "invoice.paid": {
      const customer = await getOrCreateCustomer(obj.customer);
      const amount = Number(obj.amount_paid ?? 0);
      await addInvoice(customer.id, obj.billing_reason === "subscription_create" ? "setup" : "monthly", amount, "paid");
      await db.billingCustomers.update(customer.id, {
        status: "active",
        nextBillingAt: isoFromUnix(obj.lines?.data?.[0]?.period?.end) ?? customer.nextBillingAt,
        paymentFailedAt: undefined,
      });
      break;
    }
    case "invoice.payment_failed": {
      const customer = await getOrCreateCustomer(obj.customer);
      await addInvoice(customer.id, "monthly", Number(obj.amount_due ?? 0), "failed");
      await db.billingCustomers.update(customer.id, {
        status: "past_due",
        paymentFailedAt: new Date().toISOString(),
      });
      break;
    }
    case "customer.subscription.updated": {
      const customer = await getOrCreateCustomer(obj.customer);
      const map: Record<string, BillingCustomer["status"]> = {
        active: "active",
        trialing: "active",
        past_due: "past_due",
        unpaid: "past_due",
        canceled: "canceled",
        paused: "paused",
      };
      await db.billingCustomers.update(customer.id, {
        status: map[String(obj.status)] ?? customer.status,
        nextBillingAt: isoFromUnix(obj.current_period_end) ?? customer.nextBillingAt,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const customer = await getOrCreateCustomer(obj.customer);
      await db.billingCustomers.update(customer.id, { status: "canceled", nextBillingAt: undefined });
      break;
    }
    default:
      // 未対応イベントは200で受理（再送を防ぐ）
      break;
  }

  revalidatePath("/billing");
  return new Response("ok");
}
