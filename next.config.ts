import type { NextConfig } from "next";

// 日本向けLINEツール。サーバー（Render等は標準でUTC等）のタイムゾーンに依存すると
// チャット/配信の表示時刻がズレるため、アプリ全体を日本時間に固定する。
// 別の地域で運用する場合だけ LCALL_TZ で上書き可能。
process.env.TZ = process.env.LCALL_TZ || "Asia/Tokyo";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
