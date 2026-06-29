import {
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  FileText,
  JapaneseYen,
  MousePointerClick,
  Percent,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LineBreakdown } from "@/components/charts/LineBreakdown";
import { RegistrationTrend } from "@/components/charts/RegistrationTrend";
import { ReservationAgenda } from "@/components/features/ReservationAgenda";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { getDashboardData } from "@/features/dashboard/metrics";
import { listLineAccounts } from "@/features/line-accounts/queries";
import { listReservationPages, listUpcomingReservations } from "@/features/reservations/queries";

const fmt = (n: number) => n.toLocaleString("ja-JP");
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ resAcc?: string }>;
}) {
  // チャット対応(staff)はダッシュボードを持たない＝受信箱へ。
  const user = await getSession();
  if (user?.role === "staff") redirect("/inbox");

  const { resAcc } = await searchParams;
  const [{ kpis, lineBreakdown, trend }, resPages, accounts, upcoming] = await Promise.all([
    getDashboardData(),
    listReservationPages(),
    listLineAccounts(),
    listUpcomingReservations({ lineAccountId: resAcc || undefined }),
  ]);

  const cards = [
    { label: "総LINE登録者数", value: fmt(kpis.totalFriends), icon: Users, important: true },
    { label: "本日の登録数", value: fmt(kpis.todayRegistrations), icon: UserPlus },
    {
      label: "今月の登録数",
      value: fmt(kpis.monthRegistrations),
      icon: CalendarDays,
      important: true,
    },
    { label: "配信数", value: fmt(kpis.deliveries), icon: Send },
    { label: "クリック数", value: fmt(kpis.clicks), icon: MousePointerClick },
    { label: "クリック率", value: pct(kpis.clickRate), icon: Percent },
    { label: "フォーム申込数", value: fmt(kpis.formResponses), icon: FileText },
    { label: "アンケート回答数", value: fmt(kpis.surveyResponses), icon: ClipboardList },
    // 予約決済を使っている場合のみ売上を表示（事前支払いの支払い済み合計）
    ...(resPages.length > 0
      ? [
          {
            label: "予約売上（今月）",
            value: yen(kpis.reservationRevenueMonth),
            icon: JapaneseYen,
            important: true,
          },
          {
            label: "予約売上（累計）",
            value: yen(kpis.reservationRevenue),
            icon: JapaneseYen,
          },
          {
            label: "決済済み予約数",
            value: fmt(kpis.paidReservations),
            icon: CalendarCheck,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">ダッシュボード</h1>
          <p className="mt-1 text-sm text-muted">登録・配信・反応の全体像を確認できます。</p>
        </div>
        {/* 主要アクション = ブランドCTA（アクセント限定） */}
        <Link href="/broadcasts/new" className={buttonClasses("gradient", "md")}>
          <Send className="size-4" />
          新規配信を作成
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            important={c.important}
          />
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="登録月別推移" description="直近12か月の新規登録数" />
          <div className="p-5">
            <RegistrationTrend points={trend} />
          </div>
        </Card>

        <Card>
          <CardHeader title="LINE別登録数" description="アカウント別の友だち数" />
          <div className="p-5">
            <LineBreakdown rows={lineBreakdown} />
          </div>
        </Card>
      </section>

      {resPages.length > 0 && (
        <section className="mt-6">
          <Card>
            <CardHeader title="今週の予約" description="今後7日間の確定予約" />
            <div className="space-y-3 p-5">
              {accounts.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/"
                    className={`rounded-lg px-3 py-1.5 text-sm ${!resAcc ? "bg-brand font-medium text-white" : "border border-line text-ink hover:bg-surface-2"}`}
                  >
                    すべて
                  </Link>
                  {accounts.map((a) => (
                    <Link
                      key={a.id}
                      href={`/?resAcc=${a.id}`}
                      className={`rounded-lg px-3 py-1.5 text-sm ${resAcc === a.id ? "bg-brand font-medium text-white" : "border border-line text-ink hover:bg-surface-2"}`}
                    >
                      {a.name}
                    </Link>
                  ))}
                </div>
              )}
              <ReservationAgenda
                items={upcoming.map((r) => ({
                  id: r.id,
                  startAt: r.startAt,
                  title: r.friendName,
                  sub: [r.pageTitle, r.menuName].filter(Boolean).join("・"),
                }))}
              />
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
