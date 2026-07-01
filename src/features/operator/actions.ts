"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AFFILIATE_RANKS, AFFILIATE_RATE_CAP } from "@/config/plans";
import { getDataProvider } from "@/lib/data/provider";
import type { Affiliate, AffiliateCommission, AffiliateRank, ClientAccount, PlanCode } from "@/lib/data/types";
import { accrueRecurringForPeriod, currentPeriodMonth, ensureSignupCommission } from "./affiliate";
import { callInstance, fetchInstanceStatus } from "./fleet";
import { requireOperator } from "./guard";
import { provisionTenant } from "./provision";
import { addTenantAiCredits } from "./tenant-ai";

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
  return s === "pending" || s === "trial" || s === "active" || s === "suspended" || s === "canceled"
    ? s
    : "trial";
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

  const affiliateId = str(formData.get("affiliateId")) || undefined;
  await db.clientAccounts.create({
    id,
    name,
    slug,
    contactEmail: str(formData.get("contactEmail")),
    plan: parsePlan(formData.get("plan")),
    status: "trial",
    stripeCustomerId: str(formData.get("stripeCustomerId")) || undefined,
    affiliateId,
    supportPlan: str(formData.get("supportPlan")) === "on",
    notes: str(formData.get("notes")) || undefined,
    createdAt: now,
  });

  // 紹介経由なら成約として記録し、初回報酬を計上（重複なし）。
  if (affiliateId) {
    const aff = await db.affiliates.get(affiliateId);
    if (aff) {
      await db.affiliateReferrals.create({
        id: uid("ref"),
        affiliateId,
        code: aff.code,
        landingAt: now,
        clientAccountId: id,
        convertedAt: now,
        status: "converted",
      });
      await ensureSignupCommission(id);
    }
  }

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
    stripeCustomerId: str(formData.get("stripeCustomerId")) || undefined,
    supportPlan: str(formData.get("supportPlan")) === "on",
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

/**
 * ②マルチテナント：このクライアントを今すぐ自動開通（プロビジョニング）する／失敗の再実行。
 * Neon設定があれば専用DB作成＋オーナー作成＋台帳へ databaseUrl 書込（即開通）。
 * 初期パスワードは任意（運営が設定）。空ならオーナー未作成時に自動生成（既存オーナーがあれば不要）。
 */
export async function provisionClientNow(clientId: string, formData: FormData) {
  await requireOperator();
  const password = str(formData.get("password")) || undefined;
  await provisionTenant({ clientAccountId: clientId, password });
  revalidate(clientId);
  redirect(`/operator/clients/${clientId}`);
}

/** AI購入残高を付与（運営がチャージ販売分を加算）。テナントDBの aiCredits に加算。 */
export async function grantAiCredits(clientId: string, formData: FormData) {
  await requireOperator();
  const amount = parseInt(str(formData.get("amount")) || "0", 10) || 0;
  if (amount > 0) await addTenantAiCredits(clientId, amount);
  revalidate(clientId);
  redirect(`/operator/clients/${clientId}`);
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

// ---- アフィリエイト（紹介者） ----

function affRevalidate() {
  revalidatePath("/operator/affiliates");
}
function slugCode(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
}

function parseRank(v: FormDataEntryValue | null): AffiliateRank | undefined {
  const s = String(v ?? "");
  return s === "agency" || s === "member" ? s : undefined;
}
/** "20"→0.2 / "0.2"→0.2 / 空→undefined。負値は無効。 */
function parsePercent(v: FormDataEntryValue | null): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n > 1 ? n / 100 : n;
}
/** 親（上位）がいれば親率、なければ代理店率を上限とする。 */
function capFrom(parent: Affiliate | null | undefined) {
  const rate = (a: Affiliate, kind: "signup" | "recurring") => {
    const explicit = kind === "signup" ? a.signupRate : a.recurringRate;
    if (typeof explicit === "number") return explicit;
    if (a.rank) return kind === "signup" ? AFFILIATE_RANKS[a.rank].signupRate : AFFILIATE_RANKS[a.rank].recurringRate;
    return kind === "signup" ? AFFILIATE_RATE_CAP.signup : AFFILIATE_RATE_CAP.recurring;
  };
  if (!parent) return { signup: AFFILIATE_RATE_CAP.signup, recurring: AFFILIATE_RATE_CAP.recurring };
  return { signup: rate(parent, "signup"), recurring: rate(parent, "recurring") };
}

/** 紹介者/代理店を登録（コード未指定なら自動生成・ランク/上位/料率対応・上限クランプ）。 */
export async function createAffiliate(formData: FormData) {
  await requireOperator();
  const db = getDataProvider();
  const name = str(formData.get("name")) || "無名の紹介者";
  let code = slugCode(str(formData.get("code")) || name) || `aff${Date.now().toString(36)}`;
  const existing = await db.affiliates.list();
  // コード一意化（重複なら接尾辞）
  while (existing.some((a) => a.code === code)) code = `${code}${Math.floor(Math.random() * 90 + 10)}`;

  const rank = parseRank(formData.get("rank"));
  const parentAffiliateId = str(formData.get("parentAffiliateId")) || undefined;
  const parent = parentAffiliateId ? await db.affiliates.get(parentAffiliateId) : null;
  const cap = capFrom(parent);
  // 料率：明示入力→無ければランク既定。上限（親率/代理店率）でクランプ。
  let signupRate = parsePercent(formData.get("signupRate")) ?? (rank ? AFFILIATE_RANKS[rank].signupRate : undefined);
  let recurringRate = parsePercent(formData.get("recurringRate")) ?? (rank ? AFFILIATE_RANKS[rank].recurringRate : undefined);
  if (typeof signupRate === "number") signupRate = Math.min(signupRate, cap.signup);
  if (typeof recurringRate === "number") recurringRate = Math.min(recurringRate, cap.recurring);

  await db.affiliates.create({
    id: uid("aff"),
    name,
    email: str(formData.get("email")),
    code,
    status: "active",
    rank,
    parentAffiliateId: parent ? parent.id : undefined,
    signupRate,
    recurringRate,
    portalToken: crypto.randomBytes(24).toString("hex"),
    payoutNote: str(formData.get("payoutNote")) || undefined,
    createdAt: new Date().toISOString(),
  });
  affRevalidate();
}

/** 報酬確認ページのトークンを発行/再発行（旧リンクは無効化）。 */
export async function regenerateAffiliateToken(id: string) {
  await requireOperator();
  await getDataProvider().affiliates.update(id, { portalToken: crypto.randomBytes(24).toString("hex") });
  affRevalidate();
}

/** 紹介者の有効/停止を切り替え。 */
export async function setAffiliateStatus(id: string, status: "active" | "suspended") {
  await requireOperator();
  await getDataProvider().affiliates.update(id, { status });
  affRevalidate();
}

/** 指定月（未指定は当月）の月次レベニューシェアを計上。 */
export async function accrueCommissions(formData: FormData) {
  await requireOperator();
  const period = str(formData.get("periodMonth")) || currentPeriodMonth();
  await accrueRecurringForPeriod(period);
  affRevalidate();
}

/** 報酬の状態を変更（承認/支払い済み）。 */
export async function setCommissionStatus(id: string, status: AffiliateCommission["status"]) {
  await requireOperator();
  await getDataProvider().affiliateCommissions.update(id, { status });
  affRevalidate();
}
