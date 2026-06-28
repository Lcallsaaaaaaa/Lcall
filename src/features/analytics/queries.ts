import { getDataProvider } from "@/lib/data/provider";

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export interface AnalyticsData {
  kpis: {
    total: number;
    deliveries: number;
    clicks: number;
    clickRate: number;
    formResponses: number;
    surveyResponses: number;
    ltvTotal: number;
    ltvAvg: number;
    /** ブロック数 */
    blocked: number;
    /** ブロック率（ブロック数 / 総登録） */
    blockRate: number;
    /** BAN/ブロック・解除を除いた実LINEユーザー数（status=active） */
    activeReachable: number;
  };
  lineBreakdown: { name: string; count: number }[];
  broadcastsByLine: { name: string; count: number }[];
  trend: { label: string; count: number }[];
  tagReaction: { name: string; tagged: number; clicked: number; rate: number }[];
  carouselClicks: { title: string; count: number }[];
  hourly: { hour: number; count: number }[];
  retention: { label: string; count: number }[];
  /** 登録月別の当月アクティブ（当月アクセスありの人数・率） */
  cohorts: { label: string; registered: number; activeThisMonth: number; rate: number }[];
}

export async function getAnalytics(now: Date = new Date()): Promise<AnalyticsData> {
  const db = getDataProvider();
  const [
    friends,
    lineAccounts,
    broadcasts,
    clickLogs,
    formResponses,
    surveyResponses,
    tags,
    friendTags,
    carouselCards,
  ] = await Promise.all([
    db.friends.list(),
    db.lineAccounts.list(),
    db.broadcasts.list(),
    db.clickLogs.list(),
    db.formResponses.list(),
    db.surveyResponses.list(),
    db.tags.list(),
    db.friendTags.list(),
    db.carouselCards.list(),
  ]);

  const deliveries = broadcasts.reduce((s, b) => s + b.sentCount, 0);
  const clicks = clickLogs.length;
  const ltvTotal = friends.reduce((s, f) => s + f.ltv, 0);
  // ブロック数・率／BAN・ブロック後の実LINEユーザー（status=active）
  const blocked = friends.filter((f) => f.status === "blocked").length;
  const activeReachable = friends.filter((f) => f.status === "active").length;

  // LINE別登録数
  const perLine = new Map<string, number>();
  for (const f of friends) perLine.set(f.lineAccountId, (perLine.get(f.lineAccountId) ?? 0) + 1);
  const lineBreakdown = lineAccounts
    .map((a) => ({ name: a.name, count: perLine.get(a.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // LINEアカウント別 総配信数（送信元指定はそのアカウント、全体配信は友だち数シェアで按分）
  const deliveriesByLine = new Map<string, number>();
  for (const a of lineAccounts) deliveriesByLine.set(a.id, 0);
  for (const b of broadcasts) {
    if (b.sentCount <= 0) continue;
    if (b.lineAccountId && deliveriesByLine.has(b.lineAccountId)) {
      deliveriesByLine.set(b.lineAccountId, (deliveriesByLine.get(b.lineAccountId) ?? 0) + b.sentCount);
    } else {
      for (const a of lineAccounts) {
        const share = friends.length ? (perLine.get(a.id) ?? 0) / friends.length : 0;
        deliveriesByLine.set(a.id, (deliveriesByLine.get(a.id) ?? 0) + b.sentCount * share);
      }
    }
  }
  const broadcastsByLine = lineAccounts
    .map((a) => ({ name: a.name, count: Math.round(deliveriesByLine.get(a.id) ?? 0) }))
    .sort((a, b) => b.count - a.count);

  // 登録月別（直近12か月）
  const perMonth = new Map<string, number>();
  for (const f of friends) {
    const mk = monthKey(new Date(f.registeredAt));
    perMonth.set(mk, (perMonth.get(mk) ?? 0) + 1);
  }
  const trend = [];
  for (let back = 11; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    trend.push({
      label: `${String(d.getFullYear()).slice(2)}/${pad(d.getMonth() + 1)}`,
      count: perMonth.get(monthKey(d)) ?? 0,
    });
  }

  // 登録月別の当月アクティブ（当月＝now の月に lastClickAt あり＝アクセスあり）
  const currentMonthKey = monthKey(now);
  const cohorts = [];
  for (let back = 11; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const mk = monthKey(d);
    const cohortFriends = friends.filter((f) => monthKey(new Date(f.registeredAt)) === mk);
    const activeThisMonth = cohortFriends.filter(
      (f) => f.lastClickAt && monthKey(new Date(f.lastClickAt)) === currentMonthKey
    ).length;
    cohorts.push({
      label: `${String(d.getFullYear()).slice(2)}/${pad(d.getMonth() + 1)}`,
      registered: cohortFriends.length,
      activeThisMonth,
      rate: cohortFriends.length ? activeThisMonth / cohortFriends.length : 0,
    });
  }

  // タグ別反応率（タグ保有者のうちクリック実績のある割合）
  const clickedFriendIds = new Set(clickLogs.map((c) => c.friendId).filter(Boolean) as string[]);
  const friendsByTag = new Map<string, Set<string>>();
  for (const ft of friendTags) {
    const s = friendsByTag.get(ft.tagId) ?? new Set<string>();
    s.add(ft.friendId);
    friendsByTag.set(ft.tagId, s);
  }
  const tagReaction = tags.map((t) => {
    const tagged = friendsByTag.get(t.id) ?? new Set<string>();
    let clicked = 0;
    for (const fid of tagged) if (clickedFriendIds.has(fid)) clicked++;
    return {
      name: t.name,
      tagged: tagged.size,
      clicked,
      rate: tagged.size ? clicked / tagged.size : 0,
    };
  });

  // カルーセルカード別クリック数
  const titleByLink = new Map(carouselCards.map((c) => [c.redirectLinkId, c.title || "（無題カード）"]));
  const carouselCount = new Map<string, number>();
  for (const c of clickLogs) {
    const title = titleByLink.get(c.redirectLinkId);
    if (title) carouselCount.set(title, (carouselCount.get(title) ?? 0) + 1);
  }
  const carouselClicks = [...carouselCount.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);

  // アクセス時間帯（クリックの時刻別）
  const hourCount = new Array(24).fill(0);
  for (const c of clickLogs) hourCount[new Date(c.clickedAt).getHours()]++;
  const hourly = hourCount.map((count, hour) => ({ hour, count }));

  // 残存期間分析（在籍期間の分布・簡易）
  const buckets = [
    { label: "1ヶ月未満", max: 1 },
    { label: "1〜3ヶ月", max: 3 },
    { label: "3〜6ヶ月", max: 6 },
    { label: "6ヶ月以上", max: Infinity },
  ];
  const retention = buckets.map((b) => ({ label: b.label, count: 0 }));
  for (const f of friends) {
    const months =
      (now.getFullYear() - new Date(f.registeredAt).getFullYear()) * 12 +
      (now.getMonth() - new Date(f.registeredAt).getMonth());
    const i = buckets.findIndex((b) => months < b.max);
    retention[i === -1 ? buckets.length - 1 : i].count++;
  }

  return {
    kpis: {
      total: friends.length,
      deliveries,
      clicks,
      clickRate: deliveries ? clicks / deliveries : 0,
      formResponses: formResponses.length,
      surveyResponses: surveyResponses.length,
      ltvTotal,
      ltvAvg: friends.length ? ltvTotal / friends.length : 0,
      blocked,
      blockRate: friends.length ? blocked / friends.length : 0,
      activeReachable,
    },
    lineBreakdown,
    broadcastsByLine,
    trend,
    tagReaction,
    carouselClicks,
    hourly,
    retention,
    cohorts,
  };
}
