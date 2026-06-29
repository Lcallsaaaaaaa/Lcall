"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { PAYMENT_SETTING_KEYS } from "@/features/reservations/payments";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}

async function upsertSetting(key: string, value: string) {
  const db = getDataProvider();
  const existing = (await db.systemSettings.list()).find((s) => s.key === key);
  if (existing) await db.systemSettings.update(existing.id, { value });
  else await db.systemSettings.create({ id: `set_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, key, value });
}

/**
 * 決済設定（クライアント自身の Stripe キー）を保存。owner のみ。
 * 空欄の項目は変更しない（既存値を維持）。
 */
export async function savePaymentSettings(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "owner") throw new Error("forbidden");
  const sk = str(formData.get("stripeSecretKey"));
  const wh = str(formData.get("stripeWebhookSecret"));
  if (sk) await upsertSetting(PAYMENT_SETTING_KEYS.secret, sk);
  if (wh) await upsertSetting(PAYMENT_SETTING_KEYS.webhook, wh);
  revalidatePath("/settings");
}

/** 決済設定をクリア（キーを削除して env フォールバックに戻す）。owner のみ。 */
export async function clearPaymentSettings() {
  const session = await getSession();
  if (!session || session.role !== "owner") throw new Error("forbidden");
  const db = getDataProvider();
  const settings = await db.systemSettings.list();
  for (const k of [PAYMENT_SETTING_KEYS.secret, PAYMENT_SETTING_KEYS.webhook]) {
    const s = settings.find((x) => x.key === k);
    if (s) await db.systemSettings.remove(s.id);
  }
  revalidatePath("/settings");
}
