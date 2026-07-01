// LCall カスタムNodeサーバ（② マルチテナント：1アプリ＋クライアント別DB 用）。
//
// HTTP受信時に Host（x-forwarded-host 優先）から同期でテナント slug を取り出し、
// テナント設定（databaseUrl）を解決して、リクエスト全体を
// AsyncLocalStorage.run(tenant, handler) で包む。これによりページ/アクション/APIの全てで
// 現在テナントが確実に参照でき、getDataProvider がそのテナント専用DBへ接続する。
//
// テナント解決の優先順位:
//   1) 静的レジストリ LCALL_TENANTS（JSON・テスト/特例の上書き）
//   2) 動的レジストリ＝台帳DB（LCALL_REGISTRY_DATABASE_URL）から slug→databaseUrl を解決
//      → 申込で台帳に1行増えるだけで開通。再デプロイ・env手編集が不要（フェーズ3の肝）。
//
// 起動: node server.mjs（本番ビルド後）。単一テナント運用は従来どおり `next start` でよい
// （LCALL_TENANTS も LCALL_REGISTRY_DATABASE_URL も未設定なら素通し＝後方互換）。
//
// ALS は globalThis 上の単一インスタンスを共有する（src/lib/tenant.ts と同一）。
// ※ 解決ロジックは src/lib/tenant.ts と一致させること（バンドル外のため重複保持）。
import { createServer } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import next from "next";
import postgres from "postgres";

const tenantALS = (globalThis.__lcallTenantALS ??= new AsyncLocalStorage());

function registry() {
  try {
    const v = JSON.parse(process.env.LCALL_TENANTS || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function registryDbUrl() {
  return (process.env.LCALL_REGISTRY_DATABASE_URL || "").trim();
}
function multiTenantEnabled() {
  return !!(process.env.LCALL_TENANTS || "").trim() || !!registryDbUrl();
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

// ---- 動的レジストリ（台帳DB）からの解決 ----
let ledgerSql = null;
function getLedgerSql() {
  const url = registryDbUrl();
  if (!url) return null;
  if (ledgerSql) return ledgerSql;
  ledgerSql = postgres(url, {
    ssl: process.env.PGSSL_DISABLE === "true" ? false : "require",
    prepare: false,
    max: Number(process.env.PG_REGISTRY_POOL_MAX || 2),
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return ledgerSql;
}

// slug → { value: TenantConfig|null, exp }（正引き/空引きをTTL付きでキャッシュ）
const tenantCache = new Map();
const POS_TTL_MS = Number(process.env.LCALL_REGISTRY_TTL_MS || 30_000);
const NEG_TTL_MS = 15_000;

async function resolveFromLedger(slug) {
  const sql = getLedgerSql();
  if (!sql) return null;
  // 台帳は単一テーブル lcall_kv にエンティティ別JSONで格納（postgres-adapter と一致）
  const accounts = await sql`
    select data->>'id' as id, data->>'status' as status
    from lcall_kv
    where entity = 'clientAccounts' and lower(data->>'slug') = ${slug}
    limit 1`;
  if (!accounts.length) return null;
  const { id, status } = accounts[0];
  if (status === "canceled") return null; // 解約済みは振り向けない
  const insts = await sql`
    select data->>'databaseUrl' as database_url
    from lcall_kv
    where entity = 'clientInstances' and data->>'clientAccountId' = ${id}
      and coalesce(data->>'databaseUrl','') <> ''
    limit 1`;
  if (!insts.length) return null;
  const databaseUrl = insts[0].database_url;
  return databaseUrl ? { slug, databaseUrl } : null;
}

async function resolveTenant(host) {
  if (!multiTenantEnabled()) return undefined;
  const slug = slugFromHost(host);
  if (!slug) return undefined;

  // 1) 静的レジストリ（上書き・テスト用）
  const reg = registry()[slug];
  if (reg && (reg.databaseUrl || reg.dataFile)) return { slug, ...reg };

  // 2) 動的レジストリ（台帳DB・キャッシュ付）
  if (!registryDbUrl()) return undefined;
  const now = Date.now();
  const hit = tenantCache.get(slug);
  if (hit && hit.exp > now) return hit.value ?? undefined;
  try {
    const value = await resolveFromLedger(slug);
    tenantCache.set(slug, { value, exp: now + (value ? POS_TTL_MS : NEG_TTL_MS) });
    return value ?? undefined;
  } catch (e) {
    console.error("[tenant] ledger resolve failed:", e?.message || e);
    // 失敗は短時間だけ空キャッシュ（DB一時障害で全落ちさせない）
    tenantCache.set(slug, { value: null, exp: now + 5_000 });
    return undefined;
  }
}

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false });
const handle = app.getRequestHandler();

await app.prepare();

createServer((req, res) => {
  const xfh = req.headers["x-forwarded-host"] || req.headers.host;
  const host = Array.isArray(xfh) ? xfh[0] : xfh;
  // 解決は非同期（台帳DB参照）。解決後にリクエストを als.run で包む。
  resolveTenant(host)
    .then((tenant) => {
      if (tenant) tenantALS.run(tenant, () => handle(req, res));
      else handle(req, res);
    })
    .catch(() => handle(req, res));
}).listen(port, () => {
  console.log(`> LCall server ready on :${port}${multiTenantEnabled() ? " (multi-tenant)" : ""}`);
});
