import { createPostgresProvider } from "@/lib/data/postgres-adapter";
import { getDataProvider } from "@/lib/data/provider";
import { buildEmptySeed } from "@/lib/data/seed";
import type { EntityName } from "@/lib/data/types";
import { processDueBroadcasts } from "@/features/broadcasts/deliver";
import { processReservationReminders } from "@/features/reservations/reminders";
import { processScenarios } from "@/features/scenarios/process";
import { purgeExpiredChatImages } from "@/lib/storage";
import { workerKey } from "@/lib/tracking";

/**
 * ②マルチテナント：全テナントの定期処理をコントロールプレーンから一括実行する実行口。
 *
 * 単一テナントの `/api/scenarios/run` は「叩かれたHostのテナント1件」しか処理しない。
 * こちらは台帳(ledger)から active/trial かつ databaseUrl 割当済みのテナントを列挙し、
 * それぞれの専用DBに接続して「シナリオ発火・予約配信・予約リマインド・画像パージ」を実行する。
 *
 *   cron: GET /api/operator/run-all?key={LCALL_WORKER_KEY}   （5分毎に叩く想定）
 *
 * lcall-control（台帳を持つ側）で動かす。LCALL_WORKER_KEY を lcall-control にも設定すること。
 */
export const runtime = "nodejs";

const ENTITY_NAMES = () => Object.keys(buildEmptySeed()) as EntityName[];

async function run(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== workerKey()) {
    return new Response("unauthorized", { status: 401 });
  }
  const ledger = getDataProvider();
  const [accounts, instances] = await Promise.all([
    ledger.clientAccounts.list(),
    ledger.clientInstances.list(),
  ]);
  const dbByClient = new Map(
    instances.filter((i) => i.databaseUrl).map((i) => [i.clientAccountId, i.databaseUrl as string])
  );

  const results: Array<Record<string, unknown>> = [];
  for (const c of accounts) {
    if (c.status !== "active" && c.status !== "trial") continue; // 停止/解約/未決済はスキップ
    const dbUrl = dbByClient.get(c.id);
    if (!dbUrl) continue;
    try {
      const tdb = createPostgresProvider(ENTITY_NAMES(), dbUrl);
      const sc = await processScenarios(tdb);
      const bc = await processDueBroadcasts(tdb);
      let reminded = 0;
      try {
        reminded = (await processReservationReminders(tdb)).reminded;
      } catch {
        /* リマインド失敗は他処理を止めない */
      }
      let purged = 0;
      try {
        purged = (await purgeExpiredChatImages(tdb)).purged;
      } catch {
        /* パージ失敗は他処理を止めない */
      }
      results.push({ slug: c.slug, ...sc, broadcastsSent: bc.count, reminded, purged });
    } catch (e) {
      results.push({ slug: c.slug, error: String(e instanceof Error ? e.message : e) });
    }
  }
  return Response.json({ ok: true, tenants: results.length, results });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
