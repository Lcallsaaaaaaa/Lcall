import { PLANS } from "@/config/plans";
import { getDataProvider } from "@/lib/data/provider";
import type { LineAccount, PlanCode } from "@/lib/data/types";

export interface LineAccountWithCount extends LineAccount {
  /** 実際の友だち数（登録者数） */
  friendCount: number;
}

/** lineAccountId → 友だち数 */
export async function getFriendCounts(): Promise<Map<string, number>> {
  const friends = await getDataProvider().friends.list();
  const m = new Map<string, number>();
  for (const f of friends) m.set(f.lineAccountId, (m.get(f.lineAccountId) ?? 0) + 1);
  return m;
}

export async function listLineAccounts(): Promise<LineAccountWithCount[]> {
  const db = getDataProvider();
  const [accounts, counts] = await Promise.all([db.lineAccounts.list(), getFriendCounts()]);
  return accounts
    .map((a) => ({ ...a, friendCount: counts.get(a.id) ?? 0 }))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function getLineAccount(id: string): Promise<LineAccount | null> {
  return getDataProvider().lineAccounts.get(id);
}

export async function getCurrentPlan(): Promise<PlanCode> {
  const settings = await getDataProvider().systemSettings.list();
  const value = settings.find((s) => s.key === "plan")?.value;
  return value && value in PLANS ? (value as PlanCode) : "standard";
}

/** 接続できるLINE数の上限（§10 プラン）。 */
export async function getPlanLimit(): Promise<number> {
  return PLANS[await getCurrentPlan()].lineLimit;
}
