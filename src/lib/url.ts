import { headers } from "next/headers";

/**
 * 公開URLの基底（共有リンク・Webhook URL・登録URL・決済戻りURL等の組み立て用）。
 *
 * リバースプロキシ（Render 等）の背後では Host ヘッダが内部値（localhost:10000）になり、
 * `host` から組むと共有リンクが内部URLを指してしまう。公開ホストは **x-forwarded-host** を
 * 優先する。最も確実なのは明示設定 `LCALL_PUBLIC_BASE_URL`（例 https://example.com）。
 */
export async function publicBaseUrl(): Promise<string> {
  const explicit = process.env.LCALL_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    return `${proto}://${host}`;
  } catch {
    // リクエスト文脈の外（cron 等）。呼び出し側でフォールバックする。
    return "";
  }
}
