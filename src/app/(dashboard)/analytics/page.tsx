import { ClipboardList, Download, FileText, MousePointerClick, Percent, Send, UserCheck, UserX, Users, Wallet } from "lucide-react";
import { RegistrationTrend } from "@/components/charts/RegistrationTrend";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { getAnalytics } from "@/features/analytics/queries";

const fmt = (n: number) => n.toLocaleString("ja-JP");
const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

function Bars({ rows, suffix }: { rows: { label: string; value: number; display?: string }[]; suffix?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted">データがありません。</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm text-ink">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: "#515bd4" }} />
          </div>
          <span className="w-16 shrink-0 text-right text-sm tabular-nums text-muted">
            {r.display ?? fmt(r.value)}
            {suffix}
          </span>
        </li>
      ))}
    </ul>
  );
}

function HourChart({ hourly }: { hourly: { hour: number; count: number }[] }) {
  const max = Math.max(1, ...hourly.map((h) => h.count));
  return (
    <div>
      <div className="flex h-28 items-end gap-1">
        {hourly.map((h) => (
          <div key={h.hour} className="flex-1" title={`${h.hour}時: ${h.count}`}>
            <div className="rounded-t bg-[#515bd4]" style={{ height: `${(h.count / max) * 100}%`, minHeight: h.count ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        <span>0時</span>
        <span>6時</span>
        <span>12時</span>
        <span>18時</span>
        <span>23時</span>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const a = await getAnalytics();

  const kpis = [
    { label: "総登録者数", value: fmt(a.kpis.total), icon: Users, important: true },
    { label: "配信数", value: fmt(a.kpis.deliveries), icon: Send },
    { label: "クリック数", value: fmt(a.kpis.clicks), icon: MousePointerClick },
    { label: "クリック率", value: pct(a.kpis.clickRate), icon: Percent },
    { label: "フォーム申込数", value: fmt(a.kpis.formResponses), icon: FileText },
    { label: "アンケート回答数", value: fmt(a.kpis.surveyResponses), icon: ClipboardList },
    { label: "LTV合計", value: yen(a.kpis.ltvTotal), icon: Wallet },
    { label: "LTV平均", value: yen(a.kpis.ltvAvg), icon: Wallet, important: true },
    { label: "有効LINEユーザー", value: fmt(a.kpis.activeReachable), icon: UserCheck, important: true },
    { label: "ブロック数", value: fmt(a.kpis.blocked), icon: UserX },
    { label: "ブロック率", value: pct(a.kpis.blockRate), icon: Percent },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">分析</h1>
          <p className="mt-1 text-sm text-muted">
            登録・配信・反応・LTV の分析。直近データはここで、長期分析は CSV 出力をご利用ください。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/friends" className={buttonClasses("outline", "sm")}>
            <Download className="size-4" />
            顧客CSV（全項目）
          </a>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} important={k.important} />
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="登録月別推移" description="直近12か月の新規登録数" />
          <div className="p-5">
            <RegistrationTrend points={a.trend} />
          </div>
        </Card>
        <Card>
          <CardHeader title="LINE別登録数" />
          <div className="p-5">
            <Bars rows={a.lineBreakdown.map((l) => ({ label: l.name, value: l.count, display: `${fmt(l.count)}人` }))} />
          </div>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader title="LINEアカウント別 配信数" description="送信元アカウント別の総配信数（全体配信は友だち数で按分）" />
          <div className="p-5">
            <Bars rows={a.broadcastsByLine.map((l) => ({ label: l.name, value: l.count, display: fmt(l.count) }))} />
          </div>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="タグ別反応率" description="タグ保有者のうちクリック実績のある割合" />
          <div className="p-5">
            <Bars
              rows={a.tagReaction.map((t) => ({
                label: t.name,
                value: t.rate * 100,
                display: `${pct(t.rate)}（${t.clicked}/${t.tagged}）`,
              }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="残存期間分析" description="在籍期間の分布（簡易）" />
          <div className="p-5">
            <Bars rows={a.retention.map((r) => ({ label: r.label, value: r.count, display: `${fmt(r.count)}人` }))} />
          </div>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader
            title="登録月別アクティブ（当月アクセス）"
            description="各登録月の友だちのうち、今月アクセス（クリック）があった人数と割合"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">登録月</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">登録数</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">当月アクティブ</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">アクティブ率</th>
                </tr>
              </thead>
              <tbody>
                {a.cohorts.map((c) => (
                  <tr key={c.label} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5 text-ink">{c.label}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink">{fmt(c.registered)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink">{fmt(c.activeThisMonth)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-muted">{pct(c.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader
            title="広告コード別パフォーマンス"
            description="流入元ごとの登録数・ブロック・登録後24h以内ブロック・クリック率・タグ付与（流入の質を比較）"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">広告コード</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">登録</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">ブロック</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">ブロック率</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">24h以内</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">クリック率</th>
                  {a.adSource.tags.map((t) => (
                    <th key={t.id} className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.adSource.rows.length === 0 && (
                  <tr>
                    <td colSpan={6 + a.adSource.tags.length} className="px-4 py-6 text-center text-muted">
                      データがありません。
                    </td>
                  </tr>
                )}
                {a.adSource.rows.map((r) => (
                  <tr key={r.code || "__organic__"} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink">{r.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{fmt(r.registrations)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{fmt(r.blocked)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{pct(r.blockRate)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{fmt(r.blockedWithin24h)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{pct(r.clickRate)}</td>
                    {a.adSource.tags.map((t) => (
                      <td key={t.id} className="px-4 py-2.5 text-right tabular-nums text-muted">
                        {fmt(r.tagCounts[t.id] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="アクセス時間帯" description="クリックの時刻別分布" />
          <div className="p-5">
            <HourChart hourly={a.hourly} />
          </div>
        </Card>
        <Card>
          <CardHeader title="カルーセルカード別クリック数" />
          <div className="p-5">
            <Bars rows={a.carouselClicks.map((c) => ({ label: c.title, value: c.count, display: `${fmt(c.count)}` }))} />
          </div>
        </Card>
      </section>
    </div>
  );
}
