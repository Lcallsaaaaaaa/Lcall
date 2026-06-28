"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import type { ClientAccount, PlanCode } from "@/lib/data/types";
import { callInstance, fetchInstanceStatus } from "./fleet";
import { requireOperator } from "./guard";

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function parsePlan(v: FormDataEntryValue | null): PlanCode {
  const s = String(v ?? "");
  return s === "lite" || s === "standard" || s === "pro" ? s : "standard";
}
function parseStatus(v: FormDataEntryValue | null): ClientAccount["status"] {
  const s = String(v ?? "");
  return s === "trial" || s === "active" || s === "suspended" || s === "canceled" ? s : "trial";
}
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `client-${Date.now().toString(36)}`
  );
}

function revalidate(clientId?: string) {
  revalidatePath("/operator");
  revalidatePath("/operator/clients");
  if (clientId) revalidatePath(`/operator/clients/${clientId}`);
}

/** 新規クライアント発行（台帳＋インスタンス登録・operatorKey生成）。 */
export async function createClient(formData: FormData) {
  await requireOperator();
  const db = getDataProvider();
  const name = str(formData.get("name")) || "無題のクライアント";
  const slug = str(formData.get("slug")) || slugify(name);
  const now = new Date().toISOString();
  const id = uid("ca");

  await db.clientAccounts.create({
    id,
    name,
    slug,
    contactEmail: str(formData.get("contactEmail")),
    plan: parsePlan(formData.get("plan")),
    status: "trial",
    notes: str(formData.get("notes")) || undefined,
    createdAt: now,
  });

  await db.clientInstances.create({
    id: uid("ci"),
    clientAccountId: id,
    baseUrl: str(formData.get("baseUrl")).replace(/\/$/, ""),
    // 既存インスタンスのキーを登録する場合は入力値を使用（空なら自動生成）
    operatorKey: str(formData.get("operatorKey")) || crypto.randomBytes(24).toString("hex"),
    hostingNote: str(formData.get("hostingNote")) || undefined,
    status: "unknown",
    createdAt: now,
  });

  revalidate(id);
  redirect(`/operator/clients/${id}`);
}

/** クライアント台帳の編集。 */
export async function updateClient(id: string, formData: FormData) {
  await requireOperator();
  const db = getDataProvider();
  await db.clientAccounts.update(id, {
    name: str(formData.get("name")) || "無題のクライアント",
    contactEmail: str(formData.get("contactEmail")),
    plan: parsePlan(formData.get("plan")),
    status: parseStatus(formData.get("status")),
    notes: str(formData.get("notes")) || undefined,
  });
  const instances = await db.clientInstances.list();
  const inst = instances.find((i) => i.clientAccountId === id);
  if (inst) {
    await db.clientInstances.update(inst.id, {
      baseUrl: str(formData.get("baseUrl")).replace(/\/$/, "") || inst.baseUrl,
      hostingNote: str(formData.get("hostingNote")) || undefined,
    });
  }
  revalidate(id);
  redirect(`/operator/clients/${id}`);
}

/** インスタンスの稼働を確認しメトリクスを取り込む（health→metrics）。 */
export async function refreshInstance(clientId: string, instanceId: string) {
  await requireOperator();
  const db = getDataProvider();
  const instance = await db.clientInstances.get(instanceId);
  if (!instance) return;

  const res = await fetchInstanceStatus(instance);
  await db.clientInstances.update(instanceId, {
    status: res.up ? "up" : "down",
    appVersion: res.version ?? instance.appVersion,
    lastSeenAt: new Date().toISOString(),
  });

  if (res.up && res.metrics) {
    const m = res.metrics;
    await db.instanceMetrics.create({
      id: uid("im"),
      instanceId,
      capturedAt: new Date().toISOString(),
      totalFriends: m.totalFriends,
      activeFriends: m.activeFriends,
      deliveries: m.deliveries,
      clicks: m.clicks,
      aiReplies: m.aiReplies,
      plan: m.plan ?? undefined,
      billingStatus: m.billingStatus ?? undefined,
      mrr: m.mrr,
    });
  }
  revalidate(clientId);
}

/** 納品チェックリストのステップ完了をトグル。 */
export async function toggleDeliveryStep(clientId: string, stepKey: string) {
  await requireOperator();
  const db = getDataProvider();
  const c = await db.clientAccounts.get(clientId);
  if (!c) return;
  const set = new Set(c.deliverySteps ?? []);
  if (set.has(stepKey)) set.delete(stepKey);
  else set.add(stepKey);
  await db.clientAccounts.update(clientId, { deliverySteps: [...set] });
  revalidate(clientId);
}

/** 遠隔操作：配信の一時停止/再開（インスタンスの運営APIを叩く）。 */
export async function remoteControl(
  clientId: string,
  instanceId: string,
  action: "suspend" | "resume"
) {
  await requireOperator();
  const db = getDataProvider();
  const instance = await db.clientInstances.get(instanceId);
  if (!instance) return;
  await callInstance(instance, "/api/operator/control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  }).catch(() => null);
  revalidate(clientId);
}
