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
  const adCode = new URL(request.url).searchParams.get("ad") || undefined;
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
    createdAt: new Date().toISOString(),
  });

  return NextResponse.redirect(chosen.addFriendUrl);
}
