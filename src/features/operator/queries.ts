import { deliveryProgress } from "@/config/delivery-steps";
import { getDataProvider } from "@/lib/data/provider";
import type { ClientAccount, ClientInstance, InstanceMetric } from "@/lib/data/types";

export interface ClientRow {
  client: ClientAccount;
  /** 1クライアント＝1インスタンス（モデルB）。未登録なら null。 */
  instance: ClientInstance | null;
  /** 直近のメトリクススナップショット。 */
  latest: InstanceMetric | null;
}

async function joinRows(): Promise<ClientRow[]> {
  const db = getDataProvider();
  const [clients, instances, metrics] = await Promise.all([
    db.clientAccounts.list(),
    db.clientInstances.list(),
    db.instanceMetrics.list(),
  ]);

  const instByClient = new Map<string, ClientInstance>();
  for (const i of instances) if (!instByClient.has(i.clientAccountId)) instByClient.set(i.clientAccountId, i);

  const latestByInstance = new Map<string, InstanceMetric>();
  for (const m of metrics) {
    const cur = latestByInstance.get(m.instanceId);
    if (!cur || m.capturedAt > cur.capturedAt) latestByInstance.set(m.instanceId, m);
  }

  return clients
    .map((client) => {
      const instance = instByClient.get(client.id) ?? null;
      const latest = instance ? (latestByInstance.get(instance.id) ?? null) : null;
      return { client, instance, latest };
    })
    .sort((a, b) => (a.client.createdAt < b.client.createdAt ? 1 : -1));
}

export async function listClients(): Promise<ClientRow[]> {
  return joinRows();
}

export async function getClientRow(clientId: string): Promise<ClientRow | null> {
  const rows = await joinRows();
  return rows.find((r) => r.client.id === clientId) ?? null;
}

export interface FleetSummary {
  totalClients: number;
  active: number;
  suspended: number;
  instancesUp: number;
  instancesDown: number;
  instancesUnknown: number;
  totalFriends: number;
  totalDeliveries: number;
  totalClicks: number;
  totalMrr: number;
  pastDue: number;
  /** 納品済み（必須ステップ完了）のクライアント数 */
  delivered: number;
}

export async function aggregateFleet(): Promise<FleetSummary> {
  const rows = await joinRows();
  const s: FleetSummary = {
    totalClients: rows.length,
    active: 0,
    suspended: 0,
    instancesUp: 0,
    instancesDown: 0,
    instancesUnknown: 0,
    totalFriends: 0,
    totalDeliveries: 0,
    totalClicks: 0,
    totalMrr: 0,
    pastDue: 0,
    delivered: 0,
  };
  for (const { client, instance, latest } of rows) {
    if (client.status === "active") s.active++;
    if (client.status === "suspended") s.suspended++;
    if (deliveryProgress(client.deliverySteps).delivered) s.delivered++;
    const st = instance?.status ?? "unknown";
    if (st === "up") s.instancesUp++;
    else if (st === "down") s.instancesDown++;
    else s.instancesUnknown++;
    if (latest) {
      s.totalFriends += latest.totalFriends;
      s.totalDeliveries += latest.deliveries;
      s.totalClicks += latest.clicks;
      s.totalMrr += latest.mrr ?? 0;
      if (latest.billingStatus === "past_due") s.pastDue++;
    }
  }
  return s;
}
