import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { processDueBroadcasts } from "@/features/broadcasts/deliver";
import { processScenarios } from "@/features/scenarios/process";
import { workerKey } from "@/lib/tracking";

/**
 * シナリオの時間配信を処理する実行口。定期実行（cron）から叩く想定。
 *   - cron: GET /api/scenarios/run?key={LCALL_WORKER_KEY}
 *   - 管理者: ログイン中なら key 不要
 * 本番では Cloudflare Cron / 外部スケジューラから数分間隔で呼ぶ。
 */
async function run(request: Request) {
  const url = new URL(request.url);
  const keyOk = url.searchParams.get("key") === workerKey();
  if (!keyOk && !(await getSession())) {
    return new Response("unauthorized", { status: 401 });
  }
  const db = getDataProvider();
  const result = await processScenarios(db);
  const broadcasts = await processDueBroadcasts(db);
  revalidatePath("/scenarios");
  revalidatePath("/broadcasts");
  revalidatePath("/carousel");
  revalidatePath("/");
  return Response.json({ ok: true, ...result, broadcastsSent: broadcasts.count });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
