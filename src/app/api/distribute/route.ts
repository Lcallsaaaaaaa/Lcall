import { NextResponse } from "next/server";
import { selectAccount } from "@/features/distribution/engine";
import { getCandidates, getStrategy } from "@/features/distribution/queries";
import { getDataProvider } from "@/lib/data/provider";

/**
 * 共通登録URL の実体（§5 分散登録URL管理）。
 * 現在の方式で1つのLINEを選び、その友だち追加URLへリダイレクトしつつ
 * distribution_logs に記録する。停止中/上限到達のLINEは engine 側で除外。
 * 割り当て不能時は予備LINE（あれば）へ、無ければ 503。
 */
export async function GET(request: Request) {
  const db = getDataProvider();
  const url = new URL(request.url);
  const sp = url.searchParams;
  const adCode = sp.get("ad") || undefined;
  // 広告クリックID（Google自動タグ=gclid / Meta=fbclid）。広告の遷移先を ?ad=CODE にしておくと
  // 媒体が自動で付与する。友だち追加(follow)時にコンバージョンAPIへ引き継ぐため登録ログに保存。
  const gclid = sp.get("gclid") || undefined;
  const fbclid = sp.get("fbclid") || undefined;
  // _fbp クッキー（あればMetaのマッチ品質向上）
  const fbp = request.headers.get("cookie")?.match(/(?:^|;\s*)_fbp=([^;]+)/)?.[1];
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  const [candidates, strategy] = await Promise.all([getCandidates(), getStrategy()]);
  const chosen = selectAccount(candidates, strategy);

  if (!chosen || !chosen.addFriendUrl) {
    // 予備LINE（§8 緊急導線）があればそこへ
    const accounts = await db.lineAccounts.list();
    const backupUrl = accounts.find((a) => a.backupUrl)?.backupUrl;
    if (backupUrl) return NextResponse.redirect(backupUrl);
    return new NextResponse("現在利用可能なLINEがありません。しばらくして再度お試しください。", {
      status: 503,
    });
  }

  await db.distributionLogs.create({
    id: `dl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    assignedLineAccountId: chosen.id,
    strategy,
    adCode,
    gclid,
    fbclid,
    fbp: fbp ? decodeURIComponent(fbp) : undefined,
    clientIp,
    userAgent,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.redirect(chosen.addFriendUrl);
}
