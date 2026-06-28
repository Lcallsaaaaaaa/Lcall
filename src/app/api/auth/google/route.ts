import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

const OAUTH_STATE_COOKIE = "lcall_oauth_state";

/** Google OAuth 開始。GOOGLE_* が未設定なら開発用ログインへ案内。 */
export async function GET() {
  if (!isGoogleConfigured()) {
    return redirectTo("/login?error=google_not_configured");
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
