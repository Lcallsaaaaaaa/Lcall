import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  isEmailAllowed,
  sessionCookieOptions,
  type SessionUser,
} from "@/lib/auth";

const OAUTH_STATE_COOKIE = "lcall_oauth_state";

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  picture?: string;
}

/** Google OAuth コールバック。state検証→トークン交換→userinfo取得→セッション発行。 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const savedState = store.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=oauth_state", request.url));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("token exchange failed");
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error("userinfo failed");
    const info = (await infoRes.json()) as GoogleUserInfo;

    // 本番アクセス制御: メール検証済み＋allowlist通過のみログイン許可（fail-closed）
    if (info.verified_email === false || !isEmailAllowed(info.email)) {
      return NextResponse.redirect(new URL("/login?error=not_allowed", request.url));
    }

    const user: SessionUser = {
      id: `g_${info.id}`,
      email: info.email,
      name: info.name ?? info.email,
      avatarUrl: info.picture,
      role: "owner",
    };

    const res = NextResponse.redirect(new URL("/", request.url));
    res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}
