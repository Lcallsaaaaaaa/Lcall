/**
 * クリック計測URLの組み立てと、Worker↔Next 間の共有シークレット。
 *
 * 計測の実体は Cloudflare Worker（worker/）。配信内のURLは必ずこの計測URLを経由させ、
 * Worker がリダイレクトしつつクリックを Next の取込APIへ送る（§7）。
 */

/**
 * 計測URLの基底。優先順位:
 *   1) TRACKING_BASE_URL（専用 Cloudflare Worker を立てた場合のそのURL）
 *   2) LCALL_PUBLIC_BASE_URL（公開URL）＝アプリ内蔵の /r/ で計測（Worker不要）
 *   3) http://localhost:8787（dev の wrangler）
 */
export function trackingBaseUrl(): string {
  return (
    process.env.TRACKING_BASE_URL?.trim() ||
    process.env.LCALL_PUBLIC_BASE_URL?.trim() ||
    "http://localhost:8787"
  );
}

/** Worker と Next 取込APIの共有シークレット。 */
export function workerKey(): string {
  return process.env.LCALL_WORKER_KEY ?? "lcall-dev-worker-key";
}

/**
 * 計測URLを生成。friendId 省略時は `{friendId}` プレースホルダを残す（管理画面表示・実送信時に置換）。
 * LINE内ブラウザを避けるため openExternalBrowser=1 を付与（§7）。
 */
export function trackingUrl(trackingId: string, friendId?: string): string {
  const u = friendId ? `u=${encodeURIComponent(friendId)}` : "u={friendId}";
  return `${trackingBaseUrl()}/r/${trackingId}?${u}&openExternalBrowser=1`;
}
