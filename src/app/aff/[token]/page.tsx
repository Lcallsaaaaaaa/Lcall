import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { Badge } from "@/components/ui/StatusBadge";
import { AFFILIATE_RANKS } from "@/config/plans";
import { getAffiliatePortalByToken } from "@/features/operator/affiliate";
import { isControlPlane } from "@/lib/operator";

// トークン・データを毎回評価（ビルド時に固定しない）
export const dynamic = "force-dynamic";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const pct = (n?: number) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");
const KIND: Record<string, string> = { signup: "初回", recurring: "月次" };
const CSTAT: Record<string, { tone: "neutral" | "info" | "ok"; label: string }> = {
  pending: { tone: "neutral", label: "未承認" },
  approved: { tone: "info", label: "承認済" },
  paid: { tone: "ok", label: "支払済" },
};

export default async function AffiliatePortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // アフィリ台帳はコントロールプレーン（運営）にのみ存在。テナント側では出さない。
  if (!isControlPlane()) notFound();

  const { token } = await params;
  const data = await getAffiliatePortalByToken(token);
  if (!data) notFound();

  const { affiliate: a, clients, commissions, totals, subs } = data;
  const base = (process.env.LCALL_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  const signupUrl = `${base}/signup?aff=${a.code}`;
  const isAgency = a.rank === "agency" || subs.length > 0;

  return (
    <main className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <GradientLogo />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">紹介報酬レポート</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-medium text-ink">{a.name}</span>
            {a.rank && <Badge tone={a.rank === "agency" ? "info" : "neutral"}>{AFFILIATE_RANKS[a.rank].name}</Badge>}
          </div>
        </div>

        {/* 申込リンク＋料率 */}
        <Card className="mb-5">
          <CardHeader title="あなたの申込リンク" description="このURLから申し込まれた成約があなたの報酬になります。" />
          <div className="space-y-2 p-5 text-sm">
            <div className="break-all rounded-lg border border-line bg-surface-2 p-3 font-medium text-brand">{signupUrl}</div>
            <p className="text-muted">
              報酬率：初回 <span className="font-medium text-ink">{pct(a.signupRate)}</span> ／ 継続{" "}
              <span className="font-medium text-ink">{pct(a.recurringRate)}</span>
            </p>
          </div>
        </Card>

        {/* サマリ */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Summary label="月次見込み" value={yen(totals.monthlyShare)} />
          <Summary label="未承認" value={yen(totals.pending)} />
          <Summary label="承認済" value={yen(totals.approved)} />
          <Summary label="支払済" value={yen(totals.paid)} />
        </div>

        {/* 紹介クライアント */}
        <Card className="mb-5">
          <CardHeader title="紹介した稼働クライアント" description={`${clients.length}社`} />
          {clients.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">まだ成約がありません。</p>
          ) : (
            <ul className="divide-y divide-line">
              {clients.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-4 text-sm">
                  <span className="text-ink">{c.name}</span>
                  <span className="flex items-center gap-3 text-muted">
                    <span className="uppercase">{c.plan}</span>
                    <span className="font-medium text-ink tabular-nums">{yen(c.monthly)}/月</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 代理店：配下 */}
        {isAgency && (
          <Card className="mb-5">
            <CardHeader title="配下アフィリエイト" description="配下の成約からあなたに入るオーバーライド報酬。" />
            {subs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">まだ配下がいません。</p>
            ) : (
              <ul className="divide-y divide-line">
                {subs.map((s) => (
                  <li key={s.id} className="flex items-center justify-between p-4 text-sm">
                    <span className="text-ink">
                      {s.name} <code className="text-xs text-muted">{s.code}</code>
                    </span>
                    <span className="flex items-center gap-3 text-muted">
                      <span>稼働 {s.activeClients}社</span>
                      <span className="font-medium text-ink tabular-nums">+{yen(s.overrideMonthly)}/月</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* 報酬明細 */}
        <Card>
          <CardHeader title="報酬明細" description="新しい順・最大100件。" />
          {commissions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">まだ報酬がありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">
                    <th className="px-4 py-2">クライアント</th>
                    <th className="px-4 py-2">種別</th>
                    <th className="px-4 py-2">対象月</th>
                    <th className="px-4 py-2 text-right">金額</th>
                    <th className="px-4 py-2">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 text-ink">{c.clientName}</td>
                      <td className="px-4 py-2 text-muted">{KIND[c.kind] ?? c.kind}</td>
                      <td className="px-4 py-2 text-muted">{c.periodMonth ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink">{yen(c.amount)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={CSTAT[c.status].tone}>{CSTAT[c.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-faint">
          このページはあなた専用のレポートです。リンクの共有にご注意ください。© {new Date().getFullYear()} LCall
        </p>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
