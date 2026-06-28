import { getBilling } from "@/features/billing/queries";
import { getDataProvider } from "@/lib/data/provider";
import { verifyOperatorKey } from "@/lib/operator";

export const runtime = "nodejs";

/**
 * 運営コンソール向けのこのインスタンスの主要指標。`x-lcall-operator-key` 必須。
 * GET /api/operator/metrics
 */
export async function GET(request: Request) {
  if (!verifyOperatorKey(request)) {
    return new Response("forbidden", { status: 403 });
  }

  const db = getDataProvider();
  const [friends, broadcasts, clicks, chatMessages, settings] = await Promise.all([
    db.friends.list(),
    db.broadcasts.list(),
    db.clickLogs.list(),
    db.chatMessages.list(),
    db.systemSettings.list(),
  ]);
  const billing = await getBilling();

  const suspended =
    settings.find((s) => s.key === "operations_suspended")?.value === "true";

  return Response.json({
    ok: true,
    totalFriends: friends.length,
    activeFriends: friends.filter((f) => f.status === "active").length,
    deliveries: broadcasts.reduce((s, b) => s + b.sentCount, 0),
    clicks: clicks.length,
    aiReplies: chatMessages.filter((m) => m.ai).length,
    plan: billing.customer?.plan ?? null,
    billingStatus: billing.customer?.status ?? null,
    mrr: billing.mrr,
    operationsSuspended: suspended,
    capturedAt: new Date().toISOString(),
  });
}
