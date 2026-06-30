import { AsyncLocalStorage } from "node:async_hooks";

/**
 * マルチテナント（②：1アプリ＋クライアント別DB）。
 *
 * カスタムNodeサーバ（server.mjs）が、HTTP受信時に `req.headers.host` から同期でテナントを解決し、
 * リクエスト全体を `AsyncLocalStorage.run(tenant, handler)` で包む。これにより
 * ページ描画・サーバーアクション・ルートハンドラの**すべて**で同期に現在テナントを参照でき、
 * 同期の `getDataProvider()` がそのテナント専用DBへ接続する。
 *
 * ALS は **globalThis 上の単一インスタンス**にする。server.mjs（Nextバンドル外）とアプリコードで
 * 同じインスタンスを共有するため（同一プロセス内で globalThis は共通）。
 *
 * テナント未設定（`LCALL_TENANTS` なし）や未解決のときは何もせず、従来の単一テナント（env DB）で動く。
 *
 * ※ ホスト→テナントの解決ロジックは server.mjs にも同等のものがある（バンドル外のため）。
 *    変更時は両方を一致させること。
 */
export interface TenantConfig {
  slug: string;
  /** "postgres"（databaseUrl）/ "file"（dataFile）。未指定なら databaseUrl 優先。 */
  adapter?: "postgres" | "file";
  databaseUrl?: string;
  dataFile?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __lcallTenantALS: AsyncLocalStorage<TenantConfig> | undefined;
}

/** プロセス共通の単一 ALS（server.mjs と共有）。 */
export const tenantALS: AsyncLocalStorage<TenantConfig> = (globalThis.__lcallTenantALS ??=
  new AsyncLocalStorage<TenantConfig>());

/** マルチテナントが有効か（`LCALL_TENANTS` 登録があるとき）。 */
export function multiTenantEnabled(): boolean {
  return !!process.env.LCALL_TENANTS?.trim();
}

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
 * - `LCALL_TENANT_BASE_DOMAIN`（例 lcall.jp）があれば `<slug>.lcall.jp` の最下位ラベルを取る。
 * - 未設定なら 3ラベル以上（例 acme.onrender.com）の先頭ラベルを slug とみなす。
 */
export function slugFromHost(host: string | null | undefined): string | undefined {
  if (!host) return undefined;
  const h = host.split(":")[0].trim().toLowerCase();
  if (!h) return undefined;
  const base = (process.env.LCALL_TENANT_BASE_DOMAIN || "").trim().toLowerCase();
  if (base) {
    if (h === base || !h.endsWith(`.${base}`)) return undefined;
    return h.slice(0, -(base.length + 1)).split(".").pop() || undefined;
  }
  const parts = h.split(".");
  return parts.length >= 3 ? parts[0] : undefined;
}

/** ホスト名から TenantConfig を同期で解決（server.mjs が利用）。未登録/無効は undefined。 */
export function tenantFromHost(host: string | null | undefined): TenantConfig | undefined {
  if (!multiTenantEnabled()) return undefined;
  const slug = slugFromHost(host);
  if (!slug) return undefined;
  const reg = registry()[slug];
  if (reg && (reg.databaseUrl || reg.dataFile)) return { slug, ...reg };
  return undefined;
}

/** 現在のテナント（リクエストを包む als.run から）。未設定＝単一テナント。 */
export function currentTenant(): TenantConfig | undefined {
  return tenantALS.getStore();
}

/** テナントを明示して関数を実行（テスト・特殊用途）。 */
export function runWithTenant<T>(tenant: TenantConfig, fn: () => T): T {
  return tenantALS.run(tenant, fn);
}
