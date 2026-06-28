"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import type { LineAccount, LineAccountStatus } from "@/lib/data/types";
import { getPlanLimit } from "./queries";

const STATUSES: LineAccountStatus[] = ["active", "paused", "warning", "suspended"];

function parseStatus(v: FormDataEntryValue | null): LineAccountStatus {
  const s = String(v ?? "");
  return (STATUSES as string[]).includes(s) ? (s as LineAccountStatus) : "active";
}

function num(v: FormDataEntryValue | null, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}

function bool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1";
}

function fields(formData: FormData) {
  return {
    name: str(formData.get("name")) || "新規アカウント",
    status: parseStatus(formData.get("status")),
    channelId: str(formData.get("channelId")),
    channelSecret: str(formData.get("channelSecret")),
    channelAccessToken: str(formData.get("channelAccessToken")),
    addFriendUrl: str(formData.get("addFriendUrl")),
    capacity: num(formData.get("capacity"), 5000),
    weight: num(formData.get("weight"), 1),
    backupUrl: str(formData.get("backupUrl")) || undefined,
    migrationMessage: str(formData.get("migrationMessage")) || undefined,
    aiEnabled: bool(formData.get("aiEnabled")),
    aiCharacterId: str(formData.get("aiCharacterId")) || undefined,
    aiApiKey: str(formData.get("aiApiKey")) || undefined,
  };
}

function revalidate() {
  revalidatePath("/line-accounts");
  revalidatePath("/distribution");
  revalidatePath("/");
}

export async function createLineAccount(formData: FormData) {
  const db = getDataProvider();
  const [existing, limit] = await Promise.all([db.lineAccounts.list(), getPlanLimit()]);
  if (existing.length >= limit) {
    redirect("/line-accounts?error=limit");
  }

  const account: LineAccount = {
    id: `la_${Date.now()}`,
    registeredCount: 0,
    createdAt: new Date().toISOString(),
    ...fields(formData),
  };
  await db.lineAccounts.create(account);
  revalidate();
  redirect("/line-accounts");
}

export async function updateLineAccount(id: string, formData: FormData) {
  await getDataProvider().lineAccounts.update(id, fields(formData));
  revalidate();
  redirect("/line-accounts");
}

export async function deleteLineAccount(id: string) {
  await getDataProvider().lineAccounts.remove(id);
  revalidate();
  redirect("/line-accounts");
}

/** 一覧からの簡易トグル（停止 ⇄ 再開）。 */
export async function toggleLineAccountStatus(id: string) {
  const db = getDataProvider();
  const a = await db.lineAccounts.get(id);
  if (a) {
    const next: LineAccountStatus = a.status === "paused" ? "active" : "paused";
    await db.lineAccounts.update(id, { status: next });
  }
  revalidate();
}
