import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { processDueBroadcasts } from "@/features/broadcasts/deliver";
import { processReservationReminders } from "@/features/reservations/reminders";
import { processScenarios } from "@/features/scenarios/process";
import { purgeExpiredChatImages } from "@/lib/storage";
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
  // 予約リマインド（開始24時間前以内・未送信）。失敗しても他の処理は止めない。
  let remindersSent = 0;
  try {
    remindersSent = (await processReservationReminders(db)).reminded;
  } catch {
    // noop
  }
  // 受信画像の保存期間切れを自動削除（LCALL_IMAGE_RETENTION_DAYS。内部で12時間に1回へ間引く）
  let imagesPurged = 0;
  try {
    imagesPurged = (await purgeExpiredChatImages(db)).purged;
  } catch {
    // パージ失敗で配信処理は止めない
  }
  revalidatePath("/scenarios");
  revalidatePath("/broadcasts");
  revalidatePath("/carousel");
  revalidatePath("/");
  return Response.json({
    ok: true,
    ...result,
    broadcastsSent: broadcasts.count,
    imagesPurged,
    remindersSent,
  });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
