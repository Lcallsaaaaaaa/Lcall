import { dumpKvRows } from "@/lib/data/postgres-adapter";
import { getDataProvider } from "@/lib/data/provider";
import { r2Put, r2Ready } from "@/lib/r2";
import { workerKey } from "@/lib/tracking";

/**
 * ②マルチテナント：全DB（台帳＋各テナント）の論理バックアップを R2 に保存する実行口。
 *
 * 全データは `lcall_kv`（1テーブル・JSONB）なので、pg_dump 不要でアプリから丸ごとJSON化できる。
 * 台帳（コントロールプレーン自身のDB＝env `DATABASE_URL`）と、台帳に登録された各テナントの
 * 専用DB（`ClientInstance.databaseUrl`）を巡回し、それぞれ `lcall_kv` 全行を JSON にして
 * **非公開バケット**（既定 `lcall-backups`・`R2_BACKUP_BUCKET` で変更可）へ保存する。
 *
 *   cron: GET /api/operator/backup?key={LCALL_WORKER_KEY}   （1日1回叩く想定）
 *
 * lcall-control（台帳を持つ側）で動かす。R2認証情報（R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY）と LCALL_WORKER_KEY を lcall-control にも設定すること。
 * 保存先はメディア用の公開バケットとは別の**非公開**バケットにすること（全社データのため）。
 *
 * 保管期間は R2 のライフサイクルルール（例：`backups/` 配下を30日で削除）で管理する。
 */
export const runtime = "nodejs";

const BACKUP_BUCKET = (): string => process.env.R2_BACKUP_BUCKET?.trim() || "lcall-backups";

async function backupOne(
  label: string,
  key: string,
  bucket: string,
  capturedAt: string,
  connectionUrl?: string
): Promise<Record<string, unknown>> {
  try {
    const rows = await dumpKvRows(connectionUrl);
    const body = new TextEncoder().encode(JSON.stringify({ db: label, capturedAt, rows }));
    await r2Put(bucket, key, body, "application/json");
    return { db: label, rows: rows.length, bytes: body.byteLength, key };
  } catch (e) {
    return { db: label, error: String(e instanceof Error ? e.message : e) };
  }
}

async function run(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== workerKey()) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!r2Ready()) {
    return Response.json(
      {
        ok: false,
        error:
          "R2未設定。lcall-control に R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY を設定してください。",
      },
      { status: 500 }
    );
  }

  const bucket = BACKUP_BUCKET();
  const capturedAt = new Date().toISOString(); // 例 2026-07-02T06:30:00.000Z
  const day = capturedAt.slice(0, 10); // 2026-07-02
  const stamp = capturedAt.replace(/[:.]/g, "-"); // 2026-07-02T06-30-00-000Z
  const prefix = `backups/${day}/${stamp}`;

  const ledger = getDataProvider();
  const [accounts, instances] = await Promise.all([
    ledger.clientAccounts.list(),
    ledger.clientInstances.list(),
  ]);
  const slugByClient = new Map(accounts.map((a) => [a.id, a.slug]));

  const results: Array<Record<string, unknown>> = [];

  // 1) 台帳（コントロールプレーン自身のDB＝env DATABASE_URL）
  results.push(await backupOne("ledger", `${prefix}/ledger.json`, bucket, capturedAt));

  // 2) 各テナント専用DB（databaseUrl 割当済みのみ）
  for (const inst of instances) {
    if (!inst.databaseUrl) continue;
    const slug = slugByClient.get(inst.clientAccountId) ?? inst.clientAccountId;
    const safe = String(slug).replace(/[^a-zA-Z0-9_-]+/g, "_");
    results.push(
      await backupOne(String(slug), `${prefix}/tenant-${safe}.json`, bucket, capturedAt, inst.databaseUrl)
    );
  }

  const failed = results.filter((r) => r.error).length;
  return Response.json({
    ok: failed === 0,
    capturedAt,
    bucket,
    prefix,
    backedUp: results.length - failed,
    failed,
    results,
  });
}

export async function GET(request: Request): Promise<Response> {
  return run(request);
}
export async function POST(request: Request): Promise<Response> {
  return run(request);
}
