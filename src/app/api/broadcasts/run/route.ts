import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { processDueBroadcasts } from "@/features/broadcasts/deliver";
import { workerKey } from "@/lib/tracking";

/**
 * 予約配信の送信処理を行う実行口。定期実行（cron）から叩く想定。
 *   - cron: GET /api/broadcasts/run?key={LCALL_WORKER_KEY}
 *   - 管理者: ログイン中なら key 不要
 * 本番では Cloudflare Cron / 外部スケジューラから数分間隔で呼ぶ。
 */
async function run(request: Request) {
  const url = new URL(request.url);
  const keyOk = url.searchParams.get("key") === workerKey();
  if (!keyOk && !(await getSession())) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await processDueBroadcasts(getDataProvider());
  revalidatePath("/broadcasts");
  revalidatePath("/carousel");
  revalidatePath("/");
  return Response.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
