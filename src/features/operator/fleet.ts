import type { ClientInstance, PlanCode } from "@/lib/data/types";

const TIMEOUT_MS = 8000;

/** クライアントインスタンスの運営APIをキー付きで呼ぶ。 */
export async function callInstance(
  instance: Pick<ClientInstance, "baseUrl" | "operatorKey">,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${instance.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        "x-lcall-operator-key": instance.operatorKey,
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export interface RemoteMetrics {
  totalFriends: number;
  activeFriends: number;
  deliveries: number;
  clicks: number;
  aiReplies: number;
  plan: PlanCode | null;
  billingStatus: string | null;
  mrr: number;
  operationsSuspended: boolean;
}

export interface InstanceStatus {
  up: boolean;
  version?: string;
  metrics?: RemoteMetrics;
}

/** health → metrics を取得。到達不可・403等は up:false。 */
export async function fetchInstanceStatus(
  instance: Pick<ClientInstance, "baseUrl" | "operatorKey">
): Promise<InstanceStatus> {
  try {
    const health = await callInstance(instance, "/api/operator/health");
    if (!health.ok) return { up: false };
    const hb = (await health.json().catch(() => ({}))) as { version?: string };
    const m = await callInstance(instance, "/api/operator/metrics");
    const metrics = m.ok ? ((await m.json().catch(() => undefined)) as RemoteMetrics | undefined) : undefined;
    return { up: true, version: hb.version, metrics };
  } catch {
    return { up: false };
  }
}
