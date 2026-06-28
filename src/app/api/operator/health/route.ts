import { verifyOperatorKey } from "@/lib/operator";

export const runtime = "nodejs";

/**
 * 運営コンソールからのヘルスチェック。`x-lcall-operator-key` 必須。
 * GET /api/operator/health
 */
export async function GET(request: Request) {
  if (!verifyOperatorKey(request)) {
    return new Response("forbidden", { status: 403 });
  }
  return Response.json({
    ok: true,
    version: process.env.npm_package_version ?? "0.1.0",
    time: new Date().toISOString(),
  });
}
