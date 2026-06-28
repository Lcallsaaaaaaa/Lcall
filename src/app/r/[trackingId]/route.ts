import { NextResponse } from "next/server";
import { applyAutoTagOnClick } from "@/features/tags/auto";
import { getDataProvider } from "@/lib/data/provider";

export const runtime = "nodejs";

/**
 * クリック計測リダイレクト（アプリ内蔵）。専用 Cloudflare Worker を立てない構成でも /r/ が動く。
 *   GET /r/{trackingId}?u={friendId}&openExternalBrowser=1
 * trackingBaseUrl が公開URL（LCALL_PUBLIC_BASE_URL）のとき、計測URLはここに来る。
 * 動作: リンク解決 → クリック記録（friend.lastClickAt/流入元/自動タグ）→ 302 リダイレクト。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const friendId = new URL(request.url).searchParams.get("u") || undefined;

  const db = getDataProvider();
  const link = (await db.redirectLinks.list()).find((l) => l.trackingId === trackingId);
  if (!link || !link.targetUrl) {
    return new NextResponse("リンクが見つかりません", { status: 404 });
  }

  // クリック記録（ベストエフォート。失敗してもリダイレクトは行う）
  const clickedAt = new Date().toISOString();
  try {
    await db.clickLogs.create({
      id: `cl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      redirectLinkId: link.id,
      friendId,
      broadcastId: link.broadcastId,
      adCode: link.adCode,
      clickedAt,
    });
    if (friendId) {
      const friend = await db.friends.get(friendId);
      if (friend) {
        const patch: { lastClickAt: string; sourceCode?: string } = { lastClickAt: clickedAt };
        if (link.adCode && !friend.sourceCode) patch.sourceCode = link.adCode;
        await db.friends.update(friendId, patch);
      }
      await applyAutoTagOnClick(db, link.id, friendId);
    }
  } catch {
    // 計測失敗は無視
  }

  return NextResponse.redirect(buildTarget(link.targetUrl, link.openExternalBrowser), 302);
}

/** LINEの内部ブラウザを避けるため openExternalBrowser=1 を付与。 */
function buildTarget(targetUrl: string, openExternalBrowser: boolean): string {
  if (!openExternalBrowser) return targetUrl;
  try {
    const u = new URL(targetUrl);
    u.searchParams.set("openExternalBrowser", "1");
    return u.toString();
  } catch {
    return targetUrl;
  }
}
