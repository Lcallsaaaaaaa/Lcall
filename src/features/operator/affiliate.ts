import { ADDONS, AFFILIATE_RANKS, PLANS, PRICING, planAffiliateRate } from "@/config/plans";
import { getDataProvider } from "@/lib/data/provider";
import type { DataProvider } from "@/lib/data/repository";
import type { Affiliate, AffiliateCommission, ClientAccount, PlanCode } from "@/lib/data/types";

const SUPPORT_ADDON = ADDONS.find((a) => a.key === "support_plan");

function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** 今月（YYYY-MM）。 */
export function currentPeriodMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ===== 料率の解決（明示 > ランク既定 > 従来/プラン準拠） =====

/** 初回報酬率（初期費に対する割合）。 */
export function signupRateOf(a: Affiliate): number {
  if (typeof a.signupRate === "number") return a.signupRate;
  if (a.rank) return AFFILIATE_RANKS[a.rank].signupRate;
  return PRICING.affiliateSetupRate; // 従来（30%）
}
/** 継続報酬率（月額に対する割合）。 */
export function recurringRateOf(a: Affiliate, client: ClientAccount): number {
  if (typeof a.recurringRate === "number") return a.recurringRate;
  if (a.rank) return AFFILIATE_RANKS[a.rank].recurringRate;
  return planAffiliateRate(client.plan); // 従来（プラン準拠 15%/0）
}

/** 初回（サインアップ）報酬額。affiliate 未指定は従来率（初期費×30%）。 */
export function signupCommissionAmount(a?: Affiliate): number {
  const rate = a ? signupRateOf(a) : PRICING.affiliateSetupRate;
  return Math.round(rate * PRICING.setupFee);
}

/**
 * クライアント1社あたりの月次レベニューシェア（直接紹介者基準）。
 * - base：継続率 × 月額（ランク/明示/プラン準拠）
 * - support：サポートプラン契約時 ¥15,000×20%（直接紹介者のみ）
 */
export function clientRecurringCommission(
  client: ClientAccount,
  a?: Affiliate
): { base: number; support: number; total: number } {
  const rate = a ? recurringRateOf(a, client) : planAffiliateRate(client.plan);
  const base = Math.round(rate * PLANS[client.plan].monthlyFee);
  const support =
    client.supportPlan && SUPPORT_ADDON ? Math.round(SUPPORT_ADDON.affiliateRate * SUPPORT_ADDON.amount) : 0;
  return { base, support, total: base + support };
}

/** 報酬を1件だけ計上（affiliate×client×種別[×月] で冪等）。amount<=0 はスキップ。戻り＝作成したか。 */
async function createCommissionOnce(
  db: DataProvider,
  args: {
    affiliateId: string;
    clientAccountId: string;
    kind: AffiliateCommission["kind"];
    amount: number;
    periodMonth?: string;
  }
): Promise<boolean> {
  if (!args.affiliateId || args.amount <= 0) return false;
  const commissions = await db.affiliateCommissions.list();
  const dup = commissions.some(
    (c) =>
      c.affiliateId === args.affiliateId &&
      c.clientAccountId === args.clientAccountId &&
      c.kind === args.kind &&
      (args.kind === "recurring" ? c.periodMonth === args.periodMonth : true)
  );
  if (dup) return false;
  await db.affiliateCommissions.create({
    id: uid("acm"),
    affiliateId: args.affiliateId,
    clientAccountId: args.clientAccountId,
    kind: args.kind,
    amount: args.amount,
    periodMonth: args.periodMonth,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return true;
}

/**
 * 初回報酬を計上（成約時・冪等）。紹介経由のみ。
 * 直接紹介者＝その率×初期費。上位（親）がいれば「親率−子率」のオーバーライドを親に計上。
 */
export async function ensureSignupCommission(clientId: string): Promise<boolean> {
  const db = getDataProvider();
  const client = await db.clientAccounts.get(clientId);
  if (!client?.affiliateId) return false;
  const child = await db.affiliates.get(client.affiliateId);
  if (!child) return false;

  const setupFee = PRICING.setupFee;
  let created = false;
  // 直接紹介者
  created =
    (await createCommissionOnce(db, {
      affiliateId: child.id,
      clientAccountId: clientId,
      kind: "signup",
      amount: Math.round(signupRateOf(child) * setupFee),
    })) || created;

  // 上位へのオーバーライド（合計は親率以内＝薄利保護）
  if (child.parentAffiliateId) {
    const parent = await db.affiliates.get(child.parentAffiliateId);
    if (parent && parent.status === "active") {
      const override = Math.round(Math.max(0, signupRateOf(parent) - signupRateOf(child)) * setupFee);
      created =
        (await createCommissionOnce(db, {
          affiliateId: parent.id,
          clientAccountId: clientId,
          kind: "signup",
          amount: override,
        })) || created;
    }
  }
  return created;
}

/** 1クライアント分の月次報酬を計上（同月・冪等）。直接紹介者＋上位オーバーライド。 */
export async function accrueRecurringForClient(
  clientId: string,
  periodMonth = currentPeriodMonth()
): Promise<boolean> {
  const db = getDataProvider();
  const client = await db.clientAccounts.get(clientId);
  if (!client || client.status !== "active" || !client.affiliateId) return false;
  const child = await db.affiliates.get(client.affiliateId);
  if (!child || child.status !== "active") return false;

  const monthly = PLANS[client.plan].monthlyFee;
  let created = false;

  // 直接紹介者：率×月額 ＋ サポート（20%）
  const { total: childTotal } = clientRecurringCommission(client, child);
  created =
    (await createCommissionOnce(db, {
      affiliateId: child.id,
      clientAccountId: clientId,
      kind: "recurring",
      amount: childTotal,
      periodMonth,
    })) || created;

  // 上位オーバーライド：（親率−子率）×月額（サポートは含めない）
  if (child.parentAffiliateId) {
    const parent = await db.affiliates.get(child.parentAffiliateId);
    if (parent && parent.status === "active") {
      const override = Math.round(Math.max(0, recurringRateOf(parent, client) - recurringRateOf(child, client)) * monthly);
      created =
        (await createCommissionOnce(db, {
          affiliateId: parent.id,
          clientAccountId: clientId,
          kind: "recurring",
          amount: override,
          periodMonth,
        })) || created;
    }
  }
  return created;
}

/** 指定月の月次報酬を全 active クライアントに計上。冪等。戻り＝新規計上した(client,affiliate)イベント数。 */
export async function accrueRecurringForPeriod(periodMonth = currentPeriodMonth()): Promise<number> {
  const db = getDataProvider();
  const clients = await db.clientAccounts.list();
  let created = 0;
  for (const client of clients) {
    if (client.status !== "active" || !client.affiliateId) continue;
    if (await accrueRecurringForClient(client.id, periodMonth)) created++;
  }
  return created;
}

export interface AffiliateRow {
  affiliate: Affiliate;
  /** 上位（代理店）名 */
  parentName?: string;
  /** 紐づく稼働クライアント数（直接紹介） */
  activeClients: number;
  /** 月次見込み合計（直接紹介＋配下からのオーバーライド） */
  monthlyShare: number;
  pending: number;
  approved: number;
  paid: number;
}

/** アフィリ一覧＋集計（直接分＋配下オーバーライドの月次見込み、報酬状態別合計）。 */
export async function listAffiliateRows(): Promise<AffiliateRow[]> {
  const db = getDataProvider();
  const [affiliates, clients, commissions] = await Promise.all([
    db.affiliates.list(),
    db.clientAccounts.list(),
    db.affiliateCommissions.list(),
  ]);
  const byId = new Map(affiliates.map((a) => [a.id, a]));
  const activeClients = clients.filter((c) => c.status === "active" && c.affiliateId);
  const sum = (list: AffiliateCommission[], status: AffiliateCommission["status"]) =>
    list.filter((c) => c.status === status).reduce((s, c) => s + c.amount, 0);

  return affiliates
    .map((affiliate) => {
      const myDirect = activeClients.filter((c) => c.affiliateId === affiliate.id);
      // 直接紹介の月次
      let monthlyShare = myDirect.reduce((s, c) => s + clientRecurringCommission(c, affiliate).total, 0);
      // 配下（自分を親に持つアフィリ）の成約からのオーバーライド
      const children = affiliates.filter((a) => a.parentAffiliateId === affiliate.id);
      for (const child of children) {
        const childClients = activeClients.filter((c) => c.affiliateId === child.id);
        for (const c of childClients) {
          monthlyShare += Math.round(
            Math.max(0, recurringRateOf(affiliate, c) - recurringRateOf(child, c)) * PLANS[c.plan].monthlyFee
          );
        }
      }
      const myComm = commissions.filter((c) => c.affiliateId === affiliate.id);
      return {
        affiliate,
        parentName: affiliate.parentAffiliateId ? byId.get(affiliate.parentAffiliateId)?.name : undefined,
        activeClients: myDirect.length,
        monthlyShare,
        pending: sum(myComm, "pending"),
        approved: sum(myComm, "approved"),
        paid: sum(myComm, "paid"),
      };
    })
    .sort((a, b) => (a.affiliate.createdAt < b.affiliate.createdAt ? 1 : -1));
}

export interface CommissionRow {
  commission: AffiliateCommission;
  affiliateName: string;
  clientName: string;
}

/** 報酬一覧（新しい順・既定50件）。アフィリ名・クライアント名を結合。 */
export async function listCommissionRows(limit = 50): Promise<CommissionRow[]> {
  const db = getDataProvider();
  const [comm, affs, clients] = await Promise.all([
    db.affiliateCommissions.list(),
    db.affiliates.list(),
    db.clientAccounts.list(),
  ]);
  const affName = new Map(affs.map((a) => [a.id, a.name]));
  const clName = new Map(clients.map((c) => [c.id, c.name]));
  return comm
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((commission) => ({
      commission,
      affiliateName: affName.get(commission.affiliateId) ?? commission.affiliateId,
      clientName: clName.get(commission.clientAccountId) ?? commission.clientAccountId,
    }));
}

// ===== 報酬確認ページ（配布用・トークン閲覧） =====

export interface AffiliatePortalData {
  affiliate: Affiliate;
  /** 自分が直接紹介した稼働クライアント（自分の月次報酬付き） */
  clients: { id: string; name: string; plan: PlanCode; monthly: number }[];
  /** 自分の報酬明細（新しい順） */
  commissions: {
    id: string;
    kind: AffiliateCommission["kind"];
    amount: number;
    periodMonth?: string;
    status: AffiliateCommission["status"];
    clientName: string;
    createdAt: string;
  }[];
  totals: { pending: number; approved: number; paid: number; monthlyShare: number };
  /** 代理店の場合の配下アフィリ（各の稼働数＋自分へのオーバーライド月次） */
  subs: { id: string; name: string; code: string; activeClients: number; overrideMonthly: number }[];
}

/** トークンからアフィリの報酬確認データを取得（閲覧専用）。見つからなければ null。 */
export async function getAffiliatePortalByToken(token: string): Promise<AffiliatePortalData | null> {
  const t = token?.trim();
  if (!t) return null;
  const db = getDataProvider();
  const [affiliates, clients, commissions] = await Promise.all([
    db.affiliates.list(),
    db.clientAccounts.list(),
    db.affiliateCommissions.list(),
  ]);
  const affiliate = affiliates.find((a) => a.portalToken && a.portalToken === t);
  if (!affiliate) return null;

  const clName = new Map(clients.map((c) => [c.id, c.name]));
  const myActive = clients.filter((c) => c.status === "active" && c.affiliateId === affiliate.id);
  const myClients = myActive.map((c) => ({
    id: c.id,
    name: c.name,
    plan: c.plan,
    monthly: clientRecurringCommission(c, affiliate).total,
  }));

  const allMy = commissions.filter((c) => c.affiliateId === affiliate.id);
  const sum = (status: AffiliateCommission["status"]) =>
    allMy.filter((c) => c.status === status).reduce((s, c) => s + c.amount, 0);
  const myComm = allMy
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 100)
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      amount: c.amount,
      periodMonth: c.periodMonth,
      status: c.status,
      clientName: clName.get(c.clientAccountId) ?? c.clientAccountId,
      createdAt: c.createdAt,
    }));

  // 配下（自分を親に持つアフィリ）の実績＋自分へのオーバーライド見込み
  const children = affiliates.filter((a) => a.parentAffiliateId === affiliate.id);
  const subs = children.map((child) => {
    const childActive = clients.filter((c) => c.status === "active" && c.affiliateId === child.id);
    const overrideMonthly = childActive.reduce(
      (s, c) =>
        s + Math.round(Math.max(0, recurringRateOf(affiliate, c) - recurringRateOf(child, c)) * PLANS[c.plan].monthlyFee),
      0
    );
    return { id: child.id, name: child.name, code: child.code, activeClients: childActive.length, overrideMonthly };
  });

  const monthlyShare =
    myClients.reduce((s, c) => s + c.monthly, 0) + subs.reduce((s, x) => s + x.overrideMonthly, 0);

  return {
    affiliate,
    clients: myClients,
    commissions: myComm,
    totals: { pending: sum("pending"), approved: sum("approved"), paid: sum("paid"), monthlyShare },
    subs,
  };
}
