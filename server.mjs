// LCall カスタムNodeサーバ（② マルチテナント：1アプリ＋クライアント別DB 用）。
//
// HTTP受信時に Host（x-forwarded-host 優先）から同期でテナントを解決し、リクエスト全体を
// AsyncLocalStorage.run(tenant, handler) で包む。これによりページ/アクション/APIの全てで
// 現在テナントが確実に参照でき、getDataProvider がそのテナント専用DBへ接続する。
//
// 起動: node server.mjs（本番ビルド後）。単一テナント運用は従来どおり `next start` でよい
// （LCALL_TENANTS 未設定ならこのサーバでも素通し＝後方互換）。
//
// ALS は globalThis 上の単一インスタンスを共有する（src/lib/tenant.ts と同一）。
// ※ 解決ロジックは src/lib/tenant.ts と一致させること（バンドル外のため重複保持）。
import { createServer } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import next from "next";

const tenantALS = (globalThis.__lcallTenantALS ??= new AsyncLocalStorage());

function registry() {
  try {
    const v = JSON.parse(process.env.LCALL_TENANTS || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function multiTenantEnabled() {
  return !!(process.env.LCALL_TENANTS || "").trim();
}
function slugFromHost(host) {
  if (!host) return undefined;
  const h = String(host).split(":")[0].trim().toLowerCase();
  if (!h) return undefined;
  const base = (process.env.LCALL_TENANT_BASE_DOMAIN || "").trim().toLowerCase();
  if (base) {
    if (h === base || !h.endsWith(`.${base}`)) return undefined;
    return h.slice(0, -(base.length + 1)).split(".").pop() || undefined;
  }
  const parts = h.split(".");
  return parts.length >= 3 ? parts[0] : undefined;
}
function tenantFromHost(host) {
  if (!multiTenantEnabled()) return undefined;
  const slug = slugFromHost(host);
  if (!slug) return undefined;
  const reg = registry()[slug];
  if (reg && (reg.databaseUrl || reg.dataFile)) return { slug, ...reg };
  return undefined;
}

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false });
const handle = app.getRequestHandler();

await app.prepare();

createServer((req, res) => {
  const xfh = req.headers["x-forwarded-host"] || req.headers.host;
  const host = Array.isArray(xfh) ? xfh[0] : xfh;
  const tenant = tenantFromHost(host);
  if (tenant) tenantALS.run(tenant, () => handle(req, res));
  else handle(req, res);
}).listen(port, () => {
  console.log(`> LCall server ready on :${port}${multiTenantEnabled() ? " (multi-tenant)" : ""}`);
});
