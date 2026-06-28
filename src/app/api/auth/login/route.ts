import {
  SESSION_COOKIE,
  createSessionToken,
  isDevLoginAllowed,
  sessionCookieOptions,
  verifyLogin,
  type SessionUser,
} from "@/lib/auth";
import { redirectTo } from "@/lib/http";

/**
 * ログイン。登録メールアドレス＋パスワードで認証（env の管理者資格情報と照合）。
 * メール/パスワード未入力の送信は、開発ログインが許可されている場合のみ dev ユーザーで入る。
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (email || password) {
    const user = await verifyLogin(email, password);
    if (!user) {
      return redirectTo("/login?error=bad_credentials");
    }
    const res = redirectTo("/");
    res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
    return res;
  }

  // 資格情報なしの送信 → 開発ログイン（許可時のみ）
  if (!isDevLoginAllowed()) {
    return redirectTo("/login?error=dev_disabled");
  }
  const dev: SessionUser = {
    id: "u_dev",
    email: "dev@lcall.local",
    name: "開発ユーザー",
    role: "owner",
  };
  const res = redirectTo("/");
  res.cookies.set(SESSION_COOKIE, createSessionToken(dev), sessionCookieOptions());
  return res;
}
