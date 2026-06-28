import { getFriendCounts } from "@/features/line-accounts/queries";
import { getDataProvider } from "@/lib/data/provider";
import type { DistributionStrategy } from "@/lib/data/types";
import type { Candidate } from "./engine";

export interface NamedCandidate extends Candidate {
  name: string;
  addFriendUrl: string;
}

export async function getStrategy(): Promise<DistributionStrategy> {
  const s = (await getDataProvider().systemSettings.list()).find(
    (x) => x.key === "distribution_strategy"
  )?.value;
  return s === "random" || s === "even" || s === "weighted" ? s : "weighted";
}

/**
 * 振り分け候補。count は「友だち数 + これまでの振り分けログ数」で算出し、
 * even/weighted のシミュレーションが回数を重ねるごとに分散するようにする。
 */
export async function getCandidates(): Promise<NamedCandidate[]> {
  const db = getDataProvider();
  const [accounts, friendCounts, logs] = await Promise.all([
    db.lineAccounts.list(),
    getFriendCounts(),
    db.distributionLogs.list(),
  ]);

  const logCounts = new Map<string, number>();
  for (const l of logs) {
    logCounts.set(l.assignedLineAccountId, (logCounts.get(l.assignedLineAccountId) ?? 0) + 1);
  }

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    addFriendUrl: a.addFriendUrl,
    status: a.status,
    capacity: a.capacity,
    weight: a.weight,
    count: (friendCounts.get(a.id) ?? 0) + (logCounts.get(a.id) ?? 0),
  }));
}

export interface DistributionLogRow {
  id: string;
  accountName: string;
  strategy: DistributionStrategy;
  createdAt: string;
}

export async function listDistributionLogs(limit = 20): Promise<DistributionLogRow[]> {
  const db = getDataProvider();
  const [logs, accounts] = await Promise.all([
    db.distributionLogs.list(),
    db.lineAccounts.list(),
  ]);
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  return logs
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((l) => ({
      id: l.id,
      accountName: nameById.get(l.assignedLineAccountId) ?? l.assignedLineAccountId,
      strategy: l.strategy,
      createdAt: l.createdAt,
    }));
}
