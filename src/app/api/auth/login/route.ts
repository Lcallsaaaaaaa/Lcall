import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  isDevLoginAllowed,
  sessionCookieOptions,
  verifyLogin,
  type SessionUser,
} from "@/lib/auth";

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
      return NextResponse.redirect(new URL("/login?error=bad_credentials", request.url), 303);
    }
    const res = NextResponse.redirect(new URL("/", request.url), 303);
    res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
    return res;
  }

  // 資格情報なしの送信 → 開発ログイン（許可時のみ）
  if (!isDevLoginAllowed()) {
    return NextResponse.redirect(new URL("/login?error=dev_disabled", request.url), 303);
  }
  const dev: SessionUser = {
    id: "u_dev",
    email: "dev@lcall.local",
    name: "開発ユーザー",
    role: "owner",
  };
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(SESSION_COOKIE, createSessionToken(dev), sessionCookieOptions());
  return res;
}
