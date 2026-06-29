import type { DataProvider } from "@/lib/data/repository";

/**
 * クライアント自身の Stripe 設定（決済設定画面で保存。DBの systemSettings）。
 * 予約の事前決済はこのキーで行い、売上はクライアントのStripeに入る。
 * 未設定なら env（開発者/共通）にフォールバック。
 *   systemSettings: stripe_secret_key / stripe_webhook_secret
 */
const SECRET_KEY = "stripe_secret_key";
const WEBHOOK_KEY = "stripe_webhook_secret";

export async function clientStripeSecretKey(db: DataProvider): Promise<string | undefined> {
  const v = (await db.systemSettings.list()).find((s) => s.key === SECRET_KEY)?.value?.trim();
  return v || process.env.STRIPE_SECRET_KEY?.trim() || undefined;
}

export async function clientStripeWebhookSecret(db: DataProvider): Promise<string | undefined> {
  const v = (await db.systemSettings.list()).find((s) => s.key === WEBHOOK_KEY)?.value?.trim();
  return v || process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
}

/** 予約の事前決済が使えるか（クライアントキー or env のいずれかがある）。 */
export async function clientStripeEnabled(db: DataProvider): Promise<boolean> {
  return !!(await clientStripeSecretKey(db));
}

/** UI表示用：保存済みかどうか＋末尾4桁（フルキーは返さない）。 */
export async function paymentSettingsStatus(db: DataProvider): Promise<{
  secretSet: boolean;
  secretTail: string;
  webhookSet: boolean;
  isTest: boolean;
}> {
  const settings = await db.systemSettings.list();
  const sk = settings.find((s) => s.key === SECRET_KEY)?.value?.trim() ?? "";
  const wh = settings.find((s) => s.key === WEBHOOK_KEY)?.value?.trim() ?? "";
  return {
    secretSet: !!sk,
    secretTail: sk ? sk.slice(-4) : "",
    webhookSet: !!wh,
    isTest: sk.startsWith("sk_test_"),
  };
}

export const PAYMENT_SETTING_KEYS = { secret: SECRET_KEY, webhook: WEBHOOK_KEY };
