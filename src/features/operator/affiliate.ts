import { ADDONS, PLANS, PRICING, planAffiliateRate } from "@/config/plans";
import { getDataProvider } from "@/lib/data/provider";
import type { Affiliate, AffiliateCommission, ClientAccount } from "@/lib/data/types";

const SUPPORT_ADDON = ADDONS.find((a) => a.key === "support_plan");

function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** 今月（YYYY-MM）。 */
export function currentPeriodMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * クライアント1社あたりの月次レベニューシェア（紹介報酬）。
 * - 基本：月額 × planAffiliateRate（Standard/Pro=15%、Lite=0＝対象外）
 * - サポートプラン：契約していれば ¥15,000 × 20%
 * 料率/金額の単一情報源は config/plans.ts。
 */
export function clientRecurringCommission(client: ClientAccount): {
  base: number;
  support: number;
  total: number;
} {
  const base = Math.round(planAffiliateRate(client.plan) * PLANS[client.plan].monthlyFee);
  const support =
    client.supportPlan && SUPPORT_ADDON ? Math.round(SUPPORT_ADDON.affiliateRate * SUPPORT_ADDON.amount) : 0;
  return { base, support, total: base + support };
}

/** 初回（サインアップ）報酬＝初期費 × 30%。 */
export function signupCommissionAmount(): number {
  return Math.round(PRICING.affiliateSetupRate * PRICING.setupFee);
}

/**
 * 初回報酬を1回だけ計上（成約時）。affiliate未設定・既計上ならスキップ。
 * 認証なし＝webhook/アクション両方から呼べる。
 */
export async function ensureSignupCommission(clientId: string): Promise<boolean> {
  const db = getDataProvider();
  const client = await db.clientAccounts.get(clientId);
  if (!client?.affiliateId) return false;
  const commissions = await db.affiliateCommissions.list();
  if (commissions.some((c) => c.clientAccountId === clientId && c.kind === "signup")) return false;
  await db.affiliateCommissions.create({
    id: uid("acm"),
    affiliateId: client.affiliateId,
    clientAccountId: clientId,
    kind: "signup",
    amount: signupCommissionAmount(),
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return true;
}

/**
 * 指定月の月次（recurring）報酬を計上。active のクライアント × active のアフィリにつき、
 * 同月の recurring が未計上なら金額>0で作成。冪等（同月の重複計上はしない）。
 * 戻り値＝新規計上した件数。
 */
export async function accrueRecurringForPeriod(periodMonth = currentPeriodMonth()): Promise<number> {
  const db = getDataProvider();
  const [clients, affiliates, commissions] = await Promise.all([
    db.clientAccounts.list(),
    db.affiliates.list(),
    db.affiliateCommissions.list(),
  ]);
  const activeAff = new Set(affiliates.filter((a) => a.status === "active").map((a) => a.id));
  const already = new Set(
    commissions
      .filter((c) => c.kind === "recurring" && c.periodMonth === periodMonth)
      .map((c) => c.clientAccountId)
  );
  let created = 0;
  for (const client of clients) {
    if (client.status !== "active" || !client.affiliateId || !activeAff.has(client.affiliateId)) continue;
    if (already.has(client.id)) continue;
    const { total } = clientRecurringCommission(client);
    if (total <= 0) continue;
    await db.affiliateCommissions.create({
      id: uid("acm"),
      affiliateId: client.affiliateId,
      clientAccountId: client.id,
      kind: "recurring",
      amount: total,
      periodMonth,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    created++;
  }
  return created;
}

/** 1クライアント分の月次報酬を計上（同月重複なし）。請求支払い(invoice.paid)から呼ぶ用。 */
export async function accrueRecurringForClient(
  clientId: string,
  periodMonth = currentPeriodMonth()
): Promise<boolean> {
  const db = getDataProvider();
  const client = await db.clientAccounts.get(clientId);
  if (!client || client.status !== "active" || !client.affiliateId) return false;
  const aff = await db.affiliates.get(client.affiliateId);
  if (!aff || aff.status !== "active") return false;
  const commissions = await db.affiliateCommissions.list();
  if (
    commissions.some(
      (c) => c.kind === "recurring" && c.periodMonth === periodMonth && c.clientAccountId === clientId
    )
  )
    return false;
  const { total } = clientRecurringCommission(client);
  if (total <= 0) return false;
  await db.affiliateCommissions.create({
    id: uid("acm"),
    affiliateId: client.affiliateId,
    clientAccountId: clientId,
    kind: "recurring",
    amount: total,
    periodMonth,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return true;
}

export interface AffiliateRow {
  affiliate: Affiliate;
  /** 紐づく稼働クライアント数 */
  activeClients: number;
  /** 稼働クライアントの月次レベニューシェア見込み合計 */
  monthlyShare: number;
  /** 計上済み報酬（状態別合計） */
  pending: number;
  approved: number;
  paid: number;
}

/** アフィリ一覧＋集計（クライアント数・月次見込み・報酬状態別合計）。 */
export async function listAffiliateRows(): Promise<AffiliateRow[]> {
  const db = getDataProvider();
  const [affiliates, clients, commissions] = await Promise.all([
    db.affiliates.list(),
    db.clientAccounts.list(),
    db.affiliateCommissions.list(),
  ]);
  const sum = (list: AffiliateCommission[], status: AffiliateCommission["status"]) =>
    list.filter((c) => c.status === status).reduce((s, c) => s + c.amount, 0);

  return affiliates
    .map((affiliate) => {
      const myClients = clients.filter((c) => c.affiliateId === affiliate.id && c.status === "active");
      const myComm = commissions.filter((c) => c.affiliateId === affiliate.id);
      return {
        affiliate,
        activeClients: myClients.length,
        monthlyShare: myClients.reduce((s, c) => s + clientRecurringCommission(c).total, 0),
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
