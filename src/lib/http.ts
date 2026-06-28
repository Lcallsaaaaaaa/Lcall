import { NextResponse } from "next/server";

/**
 * 相対パスでリダイレクトする。
 *
 * リバースプロキシ（Render 等）の背後では `request.url` のホストが内部アドレス
 * （localhost:10000 等）になり、`new URL(path, request.url)` で組むと外部から
 * 到達できないURLへ飛んでしまう。Location を相対パスにすると、ブラウザがリクエスト
 * 元のオリジン（公開URL）に対して解決するため、プロキシ構成でも正しく戻れる。
 *
 * Cookie を載せる場合は戻り値に `.cookies.set(...)` できる。
 */
export function redirectTo(path: string, status: 303 | 302 = 303): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } });
}
