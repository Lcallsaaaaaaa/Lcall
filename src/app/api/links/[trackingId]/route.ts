import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { workerKey } from "@/lib/tracking";

/**
 * Worker の KV 補充用。trackingId に対応するリンクの非機密フィールドを返す。
 * Worker からの呼び出しのみ（x-lcall-worker-key で検証）。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  if (request.headers.get("x-lcall-worker-key") !== workerKey()) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const { trackingId } = await params;
  const links = await getDataProvider().redirectLinks.list();
  const link = links.find((l) => l.trackingId === trackingId);
  if (!link) return new NextResponse("not found", { status: 404 });

  return NextResponse.json({
    trackingId: link.trackingId,
    targetUrl: link.targetUrl,
    openExternalBrowser: link.openExternalBrowser,
    autoTagId: link.autoTagId ?? null,
    broadcastId: link.broadcastId ?? null,
  });
}
