import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDataProvider } from "./data/provider";

/**
 * 軽量セッション（HMAC署名Cookie）。
 *
 * NextAuth(beta) を入れず、Next.js 16 ネイティブ（async cookies / Node ランタイム）で完結。
 * 開発用ログインと Google OAuth の両方からこのセッションを発行する。
 * 将来 SaaS 化で本格的なセッション基盤に差し替える際も、画面側は getSession() だけ見ればよい。
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "staff";
}

interface SessionPayload extends SessionUser {
  /** 失効時刻（ms） */
  exp: number;
}

export const SESSION_COOKIE = "lcall_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7日

function secret(): string {
  return process.env.LCALL_SESSION_SECRET ?? "lcall-insecure-dev-secret";
}

function hmac(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

/** ユーザーから署名付きトークンを作る（route handler が Cookie に載せる）。 */
export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = { ...user, exp: Date.now() + MAX_AGE_SEC * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

function verifyToken(token: string): SessionUser | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = hmac(body);
  // 長さ不一致だと timingSafeEqual が投げるため先にガード
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    const { exp: _exp, ...user } = payload;
    void _exp;
    return user;
  } catch {
    return null;
  }
}

/** Cookie 設定用のオプション（route handler の response.cookies.set に渡す）。 */
export function sessionCookieOptions(maxAge = MAX_AGE_SEC) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** 現在のセッション（未ログインなら null）。Server Component / Route Handler から呼ぶ。 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** 開発用ログインが許可されているか。 */
export function isDevLoginAllowed(): boolean {
  return (process.env.LCALL_ALLOW_DEV_LOGIN ?? "false") === "true";
}

/** Google OAuth が設定済みか。 */
export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

/** ログインを許可するメール allowlist（env `LCALL_ALLOWED_EMAILS`、カンマ/空白区切り）。 */
export function allowedEmails(): string[] {
  return (process.env.LCALL_ALLOWED_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * このメールがログインを許可されているか。
 * allowlist 未設定なら全拒否（fail-closed）＝本番でURLを知る第三者の侵入を防ぐ。
 */
export function isEmailAllowed(email: string): boolean {
  const list = allowedEmails();
  return list.length > 0 && list.includes(email.trim().toLowerCase());
}

// ===== メール＋パスワード認証 =====
// パスワードは scrypt でハッシュ化し `scrypt:<saltHex>:<hashHex>` 形式で保存（env）。
// 平文は保存しない。納品インスタンスごとに LCALL_ADMIN_EMAIL / LCALL_ADMIN_PASSWORD_HASH を設定。

/** 平文パスワードを scrypt ハッシュ（`scrypt:salt:hash`）にする。 */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** 平文と保存ハッシュを定数時間比較。 */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = (stored ?? "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length === 0) return false;
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(plain, Buffer.from(parts[1], "hex"), expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * メール＋パスワードで認証。
 * ① データ登録ユーザー（スタッフ含む・役割つき）と照合、② env の管理者（owner・ブートストラップ）。
 * 成功で SessionUser（役割つき）、不一致は null（fail-closed）。
 */
export async function verifyLogin(email: string, password: string): Promise<SessionUser | null> {
  const e = email.trim().toLowerCase();
  if (!e || !password) return null;

  // ① データ登録ユーザー（オーナーがUIで作成したスタッフ等）
  try {
    const users = await getDataProvider().users.list();
    const u = users.find((x) => x.email.trim().toLowerCase() === e);
    if (u?.passwordHash && verifyPassword(password, u.passwordHash)) {
      return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, role: u.role };
    }
  } catch {
    // データ層エラー時は env 管理者にフォールバック
  }

  // ② env のブートストラップ管理者（owner）
  const adminEmail = (process.env.LCALL_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const hash = (process.env.LCALL_ADMIN_PASSWORD_HASH ?? "").trim();
  if (adminEmail && hash && e === adminEmail && verifyPassword(password, hash)) {
    return {
      id: "u_admin",
      email: adminEmail,
      name: (process.env.LCALL_ADMIN_NAME ?? "").trim() || adminEmail,
      role: "owner",
    };
  }
  return null;
}

/** メール＋パスワード認証が設定済みか。 */
export function isPasswordAuthConfigured(): boolean {
  return Boolean(process.env.LCALL_ADMIN_EMAIL && process.env.LCALL_ADMIN_PASSWORD_HASH);
}
