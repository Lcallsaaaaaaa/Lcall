/**
 * Stripe REST クライアント（SDK非依存・fetch直叩き）。Node ランタイム前提。
 * シークレットキーは環境変数 STRIPE_SECRET_KEY（テストは sk_test_...）。
 * 未設定なら stripeEnabled()=false でモック請求にフォールバックする。
 */
import crypto from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export function stripeSecretKey(): string | undefined {
  const k = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  return k || undefined;
}

/** Stripe 連携が有効か（シークレットキーがあるか）。 */
export function stripeEnabled(): boolean {
  return !!stripeSecretKey();
}

/** テストモードのキーか（sk_test_ で始まる）。 */
export function isStripeTestKey(): boolean {
  return (stripeSecretKey() ?? "").startsWith("sk_test_");
}

/** ネスト object を Stripe の application/x-www-form-urlencoded（bracket記法）へ。 */
function appendForm(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => appendForm(params, `${key}[${i}]`, v));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      appendForm(params, `${key}[${k}]`, v);
    }
  } else {
    params.append(key, String(value));
  }
}

export function toForm(obj: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) appendForm(p, k, v);
  return p.toString();
}

export interface StripeResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/** Stripe API 呼び出し。GET は body をクエリに、POST は form body に。 */
export async function stripe<T = any>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<StripeResult<T>> {
  const key = stripeSecretKey();
  if (!key) return { ok: false, status: 0, data: null, error: "STRIPE_SECRET_KEY 未設定" };
  try {
    const qs = body ? toForm(body) : "";
    const url = method === "GET" && qs ? `${STRIPE_API}${path}?${qs}` : `${STRIPE_API}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: method === "POST" && qs ? qs : undefined,
    });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: String(e) };
  }
}

/**
 * Stripe Webhook 署名検証（公式スキーム）。
 * Stripe-Signature: t=<ts>,v1=<hex>[,v1=<hex>...]
 * signed_payload = `${t}.${rawBody}` の HMAC-SHA256(secret) を v1 と定数時間比較。
 */
export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300
): boolean {
  if (!sigHeader || !secret) return false;
  let t = "";
  const v1s: string[] = [];
  for (const part of sigHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  const ts = Number(t);
  if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const expBuf = Buffer.from(expected);
  return v1s.some((v1) => {
    const b = Buffer.from(v1);
    return b.length === expBuf.length && crypto.timingSafeEqual(expBuf, b);
  });
}
