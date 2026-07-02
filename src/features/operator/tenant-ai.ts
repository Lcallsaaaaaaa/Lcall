import { planAiMonthlyLimit } from "@/config/plans";
import { createPostgresProvider } from "@/lib/data/postgres-adapter";
import { getDataProvider } from "@/lib/data/provider";
import { buildEmptySeed } from "@/lib/data/seed";
import type { EntityName } from "@/lib/data/types";

/**
 * 運営コンソール（コントロールプレーン）から、テナント専用DBのAI無料枠/当月利用/購入残高を扱う。
 * テナントの実DB（ClientInstance.databaseUrl）へ接続して読み書きする。
 */

const ENTITY_NAMES = () => Object.keys(buildEmptySeed()) as EntityName[];

async function tenantDbFor(clientAccountId: string) {
  const db = getDataProvider();
  const client = await db.clientAccounts.get(clientAccountId);
  if (!client) return null;
  const inst = (await db.clientInstances.list()).find((i) => i.clientAccountId === clientAccountId);
  if (!inst?.databaseUrl) return null;
  return { client, tdb: createPostgresProvider(ENTITY_NAMES(), inst.databaseUrl) };
}

export interface TenantAiStatus {
  /** 月間無料枠（プランに含む・毎月リセット） */
  freeLimit: number;
  /** 今月（暦月）のAI応答回数 */
  usedThisMonth: number;
  /** 購入残高（繰り越し・無料枠超過分に使用） */
  credits: number;
}

/** テナントのAI利用状況（無料枠/当月利用/購入残高）。未開通(databaseUrl無し)なら null。 */
export async function getTenantAiStatus(clientAccountId: string): Promise<TenantAiStatus | null> {
  const ctx = await tenantDbFor(clientAccountId);
  if (!ctx) return null;
  const { client, tdb } = ctx;
  const [settings, messages] = await Promise.all([tdb.systemSettings.list(), tdb.chatMessages.list()]);
  const credits = Math.max(0, parseInt(settings.find((s) => s.key === "aiCredits")?.value ?? "0", 10) || 0);
  const ym = new Date().toISOString().slice(0, 7);
  const usedThisMonth = messages.filter((m) => m.ai && (m.createdAt ?? "").slice(0, 7) === ym).length;
  return { freeLimit: planAiMonthlyLimit(client.plan), usedThisMonth, credits };
}

/** テナントDBのプラン設定(systemSettings 'plan')を同期（プラン変更時）。 */
export async function setTenantPlan(clientAccountId: string, plan: string): Promise<boolean> {
  const ctx = await tenantDbFor(clientAccountId);
  if (!ctx) return false;
  const { tdb } = ctx;
  const settings = await tdb.systemSettings.list();
  const row = settings.find((s) => s.key === "plan");
  if (row) await tdb.systemSettings.update(row.id, { value: plan });
  else
    await tdb.systemSettings.create({
      id: `set_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      key: "plan",
      value: plan,
    });
  return true;
}

/** テナントの購入残高(aiCredits)に加算（付与）。戻り＝加算後の残高／失敗は null。 */
export async function addTenantAiCredits(clientAccountId: string, amount: number): Promise<number | null> {
  if (!Number.isFinite(amount) || amount === 0) return null;
  const ctx = await tenantDbFor(clientAccountId);
  if (!ctx) return null;
  const { tdb } = ctx;
  const settings = await tdb.systemSettings.list();
  const row = settings.find((s) => s.key === "aiCredits");
  const cur = Math.max(0, parseInt(row?.value ?? "0", 10) || 0);
  const next = Math.max(0, cur + Math.round(amount));
  if (row) await tdb.systemSettings.update(row.id, { value: String(next) });
  else
    await tdb.systemSettings.create({
      id: `set_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      key: "aiCredits",
      value: String(next),
    });
  return next;
}
