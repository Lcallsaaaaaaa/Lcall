/// <reference types="@cloudflare/workers-types" />

/**
 * LCall クリック計測 Worker（§7）。
 *
 *   GET /r/:trackingId?u={friendId}&openExternalBrowser=1
 *     1. KV(LINKS) から trackingId を引く（ミス時は Next /api/links から取得して put）
 *     2. 即 302 リダイレクト（targetUrl に openExternalBrowser=1 を付与）
 *     3. ctx.waitUntil で Next /api/clicks/ingest へ非同期POST（リダイレクトを遅延させない）
 *
 * KV はリンク表のキャッシュ（読み取り主体）に限定。クリックは KV に貯めず Next へ送る
 * （KV無料枠の書込み上限を避けるため）。
 */

export interface Env {
  LINKS: KVNamespace;
  NEXT_BASE_URL: string;
  WORKER_KEY: string;
}

interface LinkInfo {
  trackingId: string;
  targetUrl: string;
  openExternalBrowser: boolean;
  autoTagId: string | null;
  broadcastId: string | null;
}

const LINK_TTL_SEC = 60 * 60 * 24; // 1日

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/r\/([^/]+)\/?$/);
    if (!match) return new Response("Not found", { status: 404 });

    const trackingId = decodeURIComponent(match[1]);
    const friendId = url.searchParams.get("u") || undefined;

    const link = await getLink(trackingId, env);
    if (!link) return new Response("リンクが見つかりません", { status: 404 });

    // クリックは非同期で報告（リダイレクト遅延に影響させない）
    ctx.waitUntil(
      reportClick(env, { trackingId, friendId, ts: new Date().toISOString() })
    );

    return Response.redirect(buildTarget(link.targetUrl, link.openExternalBrowser), 302);
  },
};

async function getLink(trackingId: string, env: Env): Promise<LinkInfo | null> {
  const cached = (await env.LINKS.get(trackingId, "json")) as LinkInfo | null;
  if (cached) return cached;

  const res = await fetch(
    `${env.NEXT_BASE_URL}/api/links/${encodeURIComponent(trackingId)}`,
    { headers: { "x-lcall-worker-key": env.WORKER_KEY } }
  );
  if (!res.ok) return null;

  const link = (await res.json()) as LinkInfo;
  await env.LINKS.put(trackingId, JSON.stringify(link), { expirationTtl: LINK_TTL_SEC });
  return link;
}

async function reportClick(
  env: Env,
  event: { trackingId: string; friendId?: string; ts: string }
): Promise<void> {
  try {
    await fetch(`${env.NEXT_BASE_URL}/api/clicks/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lcall-worker-key": env.WORKER_KEY,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // 取込失敗はベストエフォート（リダイレクトは既に返している）
  }
}

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
