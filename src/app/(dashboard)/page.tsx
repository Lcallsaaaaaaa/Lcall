import {
  CalendarDays,
  ClipboardList,
  FileText,
  MousePointerClick,
  Percent,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { LineBreakdown } from "@/components/charts/LineBreakdown";
import { RegistrationTrend } from "@/components/charts/RegistrationTrend";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { getDashboardData } from "@/features/dashboard/metrics";

const fmt = (n: number) => n.toLocaleString("ja-JP");
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

export default async function DashboardPage() {
  const { kpis, lineBreakdown, trend } = await getDashboardData();

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
    </div>
  );
}
