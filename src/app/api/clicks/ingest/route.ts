import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { applyAutoTagOnClick } from "@/features/tags/auto";
import { workerKey } from "@/lib/tracking";

interface ClickEvent {
  trackingId?: string;
  friendId?: string;
  ts?: string;
}

/**
 * Worker からのクリック取込（§7）。clickLogs 追加・friend.lastClickAt 更新・自動タグ付与。
 * data provider（memory/sheets）経由なので保存先は単一の真実源。
 */
export async function POST(request: Request) {
  if (request.headers.get("x-lcall-worker-key") !== workerKey()) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ClickEvent | null;
  if (!body?.trackingId) return new NextResponse("bad request", { status: 400 });

  const db = getDataProvider();
  const links = await db.redirectLinks.list();
  const link = links.find((l) => l.trackingId === body.trackingId);
  if (!link) return new NextResponse("unknown link", { status: 404 });

  const clickedAt = body.ts ?? new Date().toISOString();
  await db.clickLogs.create({
    id: `cl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    redirectLinkId: link.id,
    friendId: body.friendId || undefined,
    broadcastId: link.broadcastId,
    adCode: link.adCode,
    clickedAt,
  });

  if (body.friendId) {
    const friend = await db.friends.get(body.friendId);
    if (friend) {
      const patch: { lastClickAt: string; sourceCode?: string } = { lastClickAt: clickedAt };
      // 計測URLに広告コードがあり、未設定なら流入元として付与
      if (link.adCode && !friend.sourceCode) patch.sourceCode = link.adCode;
      await db.friends.update(body.friendId, patch);
    }
    await applyAutoTagOnClick(db, link.id, body.friendId);
  }

  return NextResponse.json({ ok: true });
}
