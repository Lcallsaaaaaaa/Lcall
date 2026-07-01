/**
 * テナントのサブドメイン slug の検証・正規化（②マルチテナント）。
 *
 * slug は `<slug>.lcall.shop` のラベルになり、テナントDBの識別にも使う。
 * - 英小文字・数字・ハイフンのみ、3〜30文字、先頭末尾は英数字。
 * - 予約語（運営・基盤で使うサブドメイン）は不可。
 */

/** テナントに割り当て不可のサブドメイン（運営・基盤用）。 */
export const RESERVED_SLUGS = new Set<string>([
  "www",
  "app",
  "api",
  "admin",
  "operator",
  "console",
  "dashboard",
  "mail",
  "smtp",
  "imap",
  "ftp",
  "static",
  "assets",
  "asset",
  "cdn",
  "img",
  "images",
  "media",
  "status",
  "health",
  "help",
  "support",
  "docs",
  "doc",
  "blog",
  "news",
  "shop",
  "store",
  "pay",
  "billing",
  "stripe",
  "webhook",
  "webhooks",
  "auth",
  "login",
  "signup",
  "signin",
  "register",
  "account",
  "accounts",
  "lcall",
  "test",
  "demo",
  "staging",
  "dev",
  "internal",
]);

/** 入力を slug 候補へ正規化（英小文字・数字・ハイフン、前後ハイフン除去、30文字まで）。 */
export function normalizeSlug(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export interface SlugCheck {
  ok: boolean;
  /** NG 理由（日本語・フォーム表示用） */
  reason?: string;
}

/** slug の形式・予約語チェック（重複は別途 DB 照合）。 */
export function validateSlug(slug: string): SlugCheck {
  if (!slug) return { ok: false, reason: "サブドメインを入力してください" };
  if (slug.length < 3) return { ok: false, reason: "3文字以上にしてください" };
  if (slug.length > 30) return { ok: false, reason: "30文字以内にしてください" };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return { ok: false, reason: "英小文字・数字・ハイフンのみ（先頭末尾は英数字）" };
  }
  if (slug.includes("--")) return { ok: false, reason: "ハイフンを連続させないでください" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "このサブドメインは使用できません" };
  return { ok: true };
}
