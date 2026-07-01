import postgres from "postgres";

/**
 * ローカル/同居 PostgreSQL でのテナントDB自動作成（②マルチテナント・VPS向け）。
 *
 * Neon API の代わりに、管理接続（CREATE DATABASE 権限あり）で `lcall_<slug>` を作る。
 * ConoHa VPS 等にPostgreSQLを同居させる構成でコスト0・外部依存なしにする。
 *
 * 必要 env（運営＝コントロールプレーンのみ）:
 *   LCALL_PG_ADMIN_URL   CREATE DATABASE 可能な接続URL。末尾に管理DB名を含めること
 *                        （例: postgres://lcall_admin:PASS@127.0.0.1:5432/postgres）
 *                        テナントの接続URLは、この末尾DB名を lcall_<slug> に差し替えて生成する。
 *   PGSSL_DISABLE=true   ローカルPG（SSLなし）のとき設定（adapter/server.mjs と共通）。
 */

function adminUrl(): string | undefined {
  return process.env.LCALL_PG_ADMIN_URL?.trim() || undefined;
}

/** ローカルPGによる自動プロビジョニングが使えるか。 */
export function localPgEnabled(): boolean {
  return !!adminUrl();
}

/** slug から DB 名（英小文字・数字・アンダースコア）。 */
function dbNameForSlug(slug: string): string {
  return `lcall_${slug.replace(/[^a-z0-9]+/g, "_")}`.slice(0, 60);
}

/** 管理URLの末尾DB名を差し替えてテナント接続URLを作る（userinfoの特殊文字を壊さない文字列操作）。 */
function tenantUrlFromAdmin(admin: string, dbName: string): string {
  const [base, query] = admin.split("?");
  const schemeSep = base.indexOf("://");
  const lastSlash = base.lastIndexOf("/");
  if (schemeSep < 0 || lastSlash <= schemeSep + 2) {
    throw new Error(
      "LCALL_PG_ADMIN_URL は末尾に管理DB名を含めてください（例 .../postgres）"
    );
  }
  const withoutDb = base.slice(0, lastSlash);
  return `${withoutDb}/${dbName}${query ? `?${query}` : ""}`;
}

export interface ProvisionedDb {
  databaseUrl: string;
  dbName: string;
}

/**
 * テナント専用DBを作成し接続URLを返す。既存（42P04）は許容＝冪等。
 * CREATE DATABASE はトランザクション/パラメータ化不可のため、識別子を厳格検証して unsafe 実行。
 */
export async function provisionLocalPgDatabase(slug: string): Promise<ProvisionedDb> {
  const admin = adminUrl();
  if (!admin) throw new Error("LCALL_PG_ADMIN_URL 未設定");
  const dbName = dbNameForSlug(slug);
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error(`不正なDB名: ${dbName}`);

  const sql = postgres(admin, {
    ssl: process.env.PGSSL_DISABLE === "true" ? false : "require",
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
  });
  try {
    await sql.unsafe(`create database "${dbName}"`);
  } catch (e: unknown) {
    // 42P04 = duplicate_database（既に存在）は許容
    const code = (e as { code?: string })?.code;
    if (code !== "42P04") {
      await sql.end({ timeout: 5 });
      throw e;
    }
  }
  await sql.end({ timeout: 5 });
  return { databaseUrl: tenantUrlFromAdmin(admin, dbName), dbName };
}
