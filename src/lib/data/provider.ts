import { createFileProvider } from "./file-adapter";
import { createMemoryProvider } from "./memory-adapter";
import { createPostgresProvider } from "./postgres-adapter";
import type { DataProvider } from "./repository";
import { buildEmptySeed, buildSeed } from "./seed";
import { createSheetsProvider } from "./sheets-adapter";
import type { EntityName } from "./types";
import { createUpstashProvider } from "./upstash-adapter";
import { currentTenant, type TenantConfig } from "@/lib/tenant";

// dev のホットリロードでダミーデータが作り直されないようにグローバルへ保持
declare global {
  // eslint-disable-next-line no-var
  var __lcallDataProvider: DataProvider | undefined;
  // テナント別プロバイダのキャッシュ（②：1アプリ＋クライアント別DB）
  // eslint-disable-next-line no-var
  var __lcallTenantProviders: Map<string, DataProvider> | undefined;
}

const ENTITY_NAMES = () => Object.keys(buildEmptySeed()) as EntityName[];
const seedFactory = () => (process.env.LCALL_SEED === "empty" ? buildEmptySeed() : buildSeed());

/** テナント専用のプロバイダを構築（postgres は接続URL別、file は保存先別）。 */
function buildTenantProvider(t: TenantConfig): DataProvider {
  if (t.adapter === "file" || (!t.databaseUrl && t.dataFile)) {
    return createFileProvider(seedFactory(), t.dataFile!);
  }
  return createPostgresProvider(ENTITY_NAMES(), t.databaseUrl);
}

/**
 * アプリ唯一のデータアクセス入口。env `LCALL_DATA_ADAPTER` で実装を選択。
 * - "memory"（既定）: インメモリのダミーデータ（ローカル開発・デモ）
 * - "postgres": PostgreSQL（本番。`DATABASE_URL`。Supabase 等）
 * - "file": JSONファイル永続化（納品モデルB。`LCALL_DATA_FILE` で保存先）
 * - "upstash": Upstash Redis（サーバーレスのデモ用）
 * - "sheets": Google Sheets（差し込み口のみ・未実装）
 *
 * 自動選択: 明示指定（memory以外）を最優先。未指定/ "memory" のときは
 * `DATABASE_URL` があれば postgres、なければ Upstash 資格情報で upstash、最後に memory。
 *
 * `LCALL_SEED=empty` で新規（デモデータ無し）初期化。file アダプタ初回起動時に使用。
 * postgres は永続テーブルのため起動時シードはせず、`/api/admin/db-seed` で明示投入する。
 */
export function getDataProvider(): DataProvider {
  // ② マルチテナント：リクエストのテナントが解決済みなら、そのテナント専用DBへ。
  const tenant = currentTenant();
  if (tenant) {
    const key = tenant.databaseUrl ?? tenant.dataFile ?? tenant.slug;
    const cache = (globalThis.__lcallTenantProviders ??= new Map());
    const cached = cache.get(key);
    if (cached) return cached;
    const provider = buildTenantProvider(tenant);
    cache.set(key, provider);
    return provider;
  }

  // 単一テナント（従来）。プロセス内シングルトン。
  if (globalThis.__lcallDataProvider) return globalThis.__lcallDataProvider;

  const hasPostgres = !!process.env.DATABASE_URL?.trim();
  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const explicit = process.env.LCALL_DATA_ADAPTER?.trim();
  const adapter =
    explicit && explicit !== "memory"
      ? explicit
      : hasPostgres
        ? "postgres"
        : hasUpstash
          ? "upstash"
          : "memory";
  const dataFile = process.env.LCALL_DATA_FILE?.trim() || "./.data/lcall.json";

  const provider =
    adapter === "postgres"
      ? createPostgresProvider(ENTITY_NAMES())
      : adapter === "upstash"
        ? createUpstashProvider(seedFactory)
        : adapter === "sheets"
          ? createSheetsProvider()
          : adapter === "file"
            ? createFileProvider(seedFactory(), dataFile)
            : createMemoryProvider(buildSeed());

  globalThis.__lcallDataProvider = provider;
  return provider;
}

export type { DataProvider };
