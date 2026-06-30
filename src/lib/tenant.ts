import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { headers } from "next/headers";

/**
 * マルチテナント（②：1アプリ＋クライアント別DB）の土台。
 *
 * 既定（テナント未設定）では何もせず、従来どおり単一テナント（env のDB）として動く。
 * `LCALL_TENANTS`（slug→接続情報のJSON）が設定されると有効化し、リクエストのホスト名
 * （サブドメイン）からテナントを解決して、そのテナント専用のDBへ接続する。
 *
 * テナント解決はリクエスト境界で行い（`resolveTenantForRequest`）、AsyncLocalStorage に格納する。
 * データ層（同期の `getDataProvider`）は ALS から現在のテナントを同期で読む。
 * リクエスト文脈の外（cron・スクリプト）では未解決＝単一テナントにフォールバック。
 */
export interface TenantConfig {
  slug: string;
  /** "postgres"（databaseUrl）/ "file"（dataFile）。未指定なら databaseUrl 優先。 */
  adapter?: "postgres" | "file";
  databaseUrl?: string;
  dataFile?: string;
}

const als = new AsyncLocalStorage<TenantConfig>();

/**
 * リクエスト単位で共有されるテナント保持箱（React cache）。
 * Server Component のレンダリングでは layout→page で AsyncLocalStorage の enterWith が
 * 伝播しない（別の非同期コンテキスト）。React の cache() はレンダーツリー全体で同一インスタンスを
 * 返すため、layout でセット→page で同期参照できる。route handler / server action は
 * 単一フレームなので als（enterWith）で拾う。currentTenant は両方を見る。
 */
const tenantHolder = cache((): { value?: TenantConfig } => ({}));

/** マルチテナントが有効か（`LCALL_TENANTS` 登録があるとき）。 */
export function multiTenantEnabled(): boolean {
  return !!process.env.LCALL_TENANTS?.trim();
}

/** env `LCALL_TENANTS` のレジストリ（slug → 接続情報）。不正JSONは空扱い。 */
function registry(): Record<string, Partial<TenantConfig>> {
  try {
    const v = JSON.parse(process.env.LCALL_TENANTS || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/**
 * ホスト名からテナント slug を抽出。
 * - `LCALL_TENANT_BASE_DOMAIN`（例 lcall.jp）が設定されていれば `<slug>.lcall.jp` の slug を取る。
 * - 未設定なら、3ラベル以上（例 acme.onrender.com）の先頭ラベルを slug とみなす。
 */
export function slugFromHost(host: string | null | undefined): string | undefined {
  if (!host) return undefined;
  const h = host.split(":")[0].trim().toLowerCase();
  if (!h) return undefined;
  const base = (process.env.LCALL_TENANT_BASE_DOMAIN || "").trim().toLowerCase();
  if (base) {
    if (h === base || !h.endsWith(`.${base}`)) return undefined;
    const sub = h.slice(0, -(base.length + 1));
    return sub.split(".").pop() || undefined; // 最下位ラベル
  }
  const parts = h.split(".");
  return parts.length >= 3 ? parts[0] : undefined;
}

/** 現在のテナント。route/action は ALS、ページレンダーは React cache から取得。未設定＝単一テナント。 */
export function currentTenant(): TenantConfig | undefined {
  const fromAls = als.getStore();
  if (fromAls) return fromAls;
  try {
    return tenantHolder().value;
  } catch {
    return undefined;
  }
}

/**
 * ホストからテナントを解決して返す（ALSは触らない）。多テナント無効・リクエスト外・
 * 未登録slug は undefined。※ enterWith は**呼び出し側の同期フレーム**で行う必要があるため、
 * ここでは解決のみ（awaitを跨いだ enterWith は呼び出し元の継続に伝播しない）。
 */
export async function resolveTenant(): Promise<TenantConfig | undefined> {
  if (!multiTenantEnabled()) return undefined;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const slug = slugFromHost(host);
    if (!slug) return undefined;
    const reg = registry()[slug];
    if (reg && (reg.databaseUrl || reg.dataFile)) return { slug, ...reg };
  } catch {
    /* リクエスト文脈の外 */
  }
  return undefined;
}

/**
 * このテナントを現在のリクエストに適用（resolveTenant の直後に呼ぶ）。
 * - React cache の保持箱：ページレンダー（layout→page）で同期参照できる。
 * - ALS（enterWith）：route handler / server action / 同フレームの後続 await 用。
 */
export function enterTenant(tenant: TenantConfig): void {
  try {
    tenantHolder().value = tenant;
  } catch {
    /* レンダー外（route/action）では cache は使えない＝ALS で拾う */
  }
  als.enterWith(tenant);
}

/**
 * リクエスト境界で「解決→適用」をまとめて行う。
 * ※必ず**呼び出し側で await して**使い、await 後は同じフレームで処理を続けること
 * （`await resolveTenantForRequest()` の後、同フレームの getDataProvider が現テナントを読む）。
 */
export async function resolveTenantForRequest(): Promise<void> {
  if (als.getStore()) return;
  const t = await resolveTenant();
  if (t) als.enterWith(t);
}

/** テナントを明示して関数を実行（API/サーバーアクションの入口での利用想定）。 */
export function runWithTenant<T>(tenant: TenantConfig, fn: () => T): T {
  return als.run(tenant, fn);
}
