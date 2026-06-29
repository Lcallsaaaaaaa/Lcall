import { getDataProvider } from "@/lib/data/provider";
import type { LineAccountStatus } from "@/lib/data/types";

export interface DashboardKpis {
  totalFriends: number;
  todayRegistrations: number;
  monthRegistrations: number;
  /** 総送信通数（配信数） */
  deliveries: number;
  clicks: number;
  /** クリック率（0〜1） */
  clickRate: number;
  formResponses: number;
  surveyResponses: number;
  /** 予約の決済売上（支払い済み reservation.amount の合計・累計） */
  reservationRevenue: number;
  /** 今月の予約決済売上（支払い済み・作成月が当月） */
  reservationRevenueMonth: number;
  /** 支払い済み予約の件数（累計） */
  paidReservations: number;
}

export interface LineBreakdownRow {
  id: string;
  name: string;
  status: LineAccountStatus;
  count: number;
  capacity: number;
}

export interface TrendPoint {
  label: string;
  count: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  lineBreakdown: LineBreakdownRow[];
  trend: TrendPoint[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** ダッシュボードの全指標を集計（§5 ダッシュボード表示項目）。 */
export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const db = getDataProvider();
  const [friends, lineAccounts, broadcasts, clickLogs, formResponses, surveyResponses, reservations] =
    await Promise.all([
      db.friends.list(),
      db.lineAccounts.list(),
      db.broadcasts.list(),
      db.clickLogs.list(),
      db.formResponses.list(),
      db.surveyResponses.list(),
      db.reservations.list(),
    ]);

  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const thisMonthKey = monthKey(now);

  let todayRegistrations = 0;
  let monthRegistrations = 0;
  const perLine = new Map<string, number>();
  const perMonth = new Map<string, number>();

  for (const f of friends) {
    const d = new Date(f.registeredAt);
    const dayKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (dayKey === todayKey) todayRegistrations++;
    if (monthKey(d) === thisMonthKey) monthRegistrations++;
    perLine.set(f.lineAccountId, (perLine.get(f.lineAccountId) ?? 0) + 1);
    const mk = monthKey(d);
    perMonth.set(mk, (perMonth.get(mk) ?? 0) + 1);
  }

  const deliveries = broadcasts.reduce((s, b) => s + b.sentCount, 0);
  const clicks = clickLogs.length;

  // 予約の決済売上（支払い済みのみ。返金済み・未払いは除外）
  let reservationRevenue = 0;
  let reservationRevenueMonth = 0;
  let paidReservations = 0;
  for (const r of reservations) {
    if (r.paymentStatus !== "paid" || typeof r.amount !== "number") continue;
    reservationRevenue += r.amount;
    paidReservations++;
    if (monthKey(new Date(r.createdAt)) === thisMonthKey) reservationRevenueMonth += r.amount;
  }

  const kpis: DashboardKpis = {
    totalFriends: friends.length,
    todayRegistrations,
    monthRegistrations,
    deliveries,
    clicks,
    clickRate: deliveries > 0 ? clicks / deliveries : 0,
    formResponses: formResponses.length,
    surveyResponses: surveyResponses.length,
    reservationRevenue,
    reservationRevenueMonth,
    paidReservations,
  };

  const lineBreakdown: LineBreakdownRow[] = lineAccounts
    .map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      count: perLine.get(a.id) ?? 0,
      capacity: a.capacity,
    }))
    .sort((a, b) => b.count - a.count);

  // 直近12か月（当月含む）の登録推移
  const trend: TrendPoint[] = [];
  for (let back = 11; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    trend.push({
      label: `${String(d.getFullYear()).slice(2)}/${pad(d.getMonth() + 1)}`,
      count: perMonth.get(monthKey(d)) ?? 0,
    });
  }

  return { kpis, lineBreakdown, trend };
}
