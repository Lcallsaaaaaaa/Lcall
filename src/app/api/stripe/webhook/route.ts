import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data/provider";
import type { BillingCustomer, Invoice, PlanCode } from "@/lib/data/types";
import { finalizeReservationConfirmed } from "@/features/reservations/finalize";
import { stripe, verifyStripeSignature } from "@/lib/stripe";

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
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET 未設定", { status: 500 });

  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return new Response("invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const db = getDataProvider();
  const obj = event?.data?.object ?? {};

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
