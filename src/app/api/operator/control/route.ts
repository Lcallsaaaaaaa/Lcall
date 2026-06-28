import { getDataProvider } from "@/lib/data/provider";
import { isOperationsSuspended, setOperationsSuspended, verifyOperatorKey } from "@/lib/operator";

export const runtime = "nodejs";

/**
 * 運営コンソールからの遠隔操作。`x-lcall-operator-key` 必須。
 * POST /api/operator/control  body: { action: "suspend" | "resume" }
 *
 * 運用フラグ（配信の一時停止/再開）に限定。インフラ操作（再デプロイ等）は対象外。
 */
export async function POST(request: Request) {
  if (!verifyOperatorKey(request)) {
    return new Response("forbidden", { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;
  const db = getDataProvider();

  if (action === "suspend") {
    await setOperationsSuspended(db, true);
  } else if (action === "resume") {
    await setOperationsSuspended(db, false);
  } else {
    return new Response("bad request: action must be suspend|resume", { status: 400 });
  }

  return Response.json({ ok: true, operationsSuspended: await isOperationsSuspended(db) });
}
