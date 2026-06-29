/**
 * クリック計測URLの組み立てと、Worker↔Next 間の共有シークレット。
 *
 * 計測の実体は Cloudflare Worker（worker/）。配信内のURLは必ずこの計測URLを経由させ、
 * Worker がリダイレクトしつつクリックを Next の取込APIへ送る（§7）。
 */
import { publicBaseUrl } from "@/lib/url";

/**
 * 計測URLの基底。優先順位:
 *   1) TRACKING_BASE_URL（専用 Cloudflare Worker を本番URLで明示設定した場合のみ）
 *   2) LCALL_PUBLIC_BASE_URL（公開URL）＝アプリ内蔵の /r/ で計測（Worker不要）
 *   3) http://localhost:8787（dev の wrangler）
 *
 * 重要: `TRACKING_BASE_URL` が localhost を指す（開発用の設定残り等）場合は、
 * 公開URLが設定されていればそちらを優先する。これにより本番のカルーセル/計測URLに
 * localhost が混入して実際の友だちに配信されてしまう事故を防ぐ。
 */
export function trackingBaseUrl(): string {
  const strip = (u: string) => u.replace(/\/+$/, "");
  const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(u);
  const explicit = process.env.TRACKING_BASE_URL?.trim();
  const publicBase = process.env.LCALL_PUBLIC_BASE_URL?.trim();
  // 専用Workerを本番URLで明示したときだけ最優先（localhost の設定残りは無視）
  if (explicit && !isLocal(explicit)) return strip(explicit);
  // 公開URLがあればアプリ内蔵 /r/ で計測（Worker不要）
  if (publicBase) return strip(publicBase);
  // どちらも無いローカル開発: 明示の localhost 値、最後に dev 既定 Worker
  return explicit ? strip(explicit) : "http://localhost:8787";
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

const isLocalUrl = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(u);

/**
 * 計測URLの基底（リクエスト文脈版）。env が未設定でも、アクセス中の公開ホスト
 * （x-forwarded-host）から基底を導出する。これにより `LCALL_PUBLIC_BASE_URL` を
 * 設定し忘れていても、チャットからのカルーセル送信や管理画面表示で localhost が
 * 混入しない。Worker を本番URLで明示した場合のみそれを最優先。
 * ※ cron 等のリクエスト外では publicBaseUrl() が空を返すため env 同期版にフォールバック。
 */
export async function trackingBaseUrlForRequest(): Promise<string> {
  const strip = (u: string) => u.replace(/\/+$/, "");
  const explicit = process.env.TRACKING_BASE_URL?.trim();
  if (explicit && !isLocalUrl(explicit)) return strip(explicit);
  const base = await publicBaseUrl(); // env or x-forwarded-host
  if (base && !isLocalUrl(base)) return strip(base);
  return trackingBaseUrl(); // env同期版（最後の手段。localhost を含みうる）
}

/** trackingUrl のリクエスト文脈版（env未設定でも公開ホストから組み立てる）。 */
export async function trackingUrlForRequest(trackingId: string, friendId?: string): Promise<string> {
  const u = friendId ? `u=${encodeURIComponent(friendId)}` : "u={friendId}";
  return `${await trackingBaseUrlForRequest()}/r/${trackingId}?${u}&openExternalBrowser=1`;
}
