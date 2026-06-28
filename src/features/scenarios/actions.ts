"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import { processScenarios } from "./process";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export async function createScenario(formData: FormData) {
  const id = uid("sc");
  await getDataProvider().scenarios.create({
    id,
    name: str(formData.get("name")) || "無題のシナリオ",
    status: "active",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/scenarios");
  redirect(`/scenarios/${id}`);
}

export async function updateScenario(id: string, formData: FormData) {
  const status = str(formData.get("status")) === "paused" ? "paused" : "active";
  await getDataProvider().scenarios.update(id, {
    name: str(formData.get("name")) || "無題のシナリオ",
    status,
    targetTagId: str(formData.get("targetTagId")) || undefined,
  });
  revalidatePath(`/scenarios/${id}`);
  revalidatePath("/scenarios");
}

export async function deleteScenario(id: string) {
  const db = getDataProvider();
  const [steps, deliveries] = await Promise.all([
    db.scenarioSteps.list(),
    db.scenarioDeliveries.list(),
  ]);
  await Promise.all([
    ...steps.filter((s) => s.scenarioId === id).map((s) => db.scenarioSteps.remove(s.id)),
    ...deliveries.filter((d) => d.scenarioId === id).map((d) => db.scenarioDeliveries.remove(d.id)),
  ]);
  await db.scenarios.remove(id);
  revalidatePath("/scenarios");
  redirect("/scenarios");
}

function toMinutes(value: number, unit: string): number {
  if (unit === "day") return value * 1440;
  if (unit === "hour") return value * 60;
  return value;
}

/** ステップフォームの共通項目を解析（追加・編集で共用）。 */
function parseStepFields(formData: FormData) {
  const value = Math.max(0, Number(formData.get("delayValue")) || 0);
  const unit = str(formData.get("delayUnit")) || "day";

  const cm = str(formData.get("conditionMode"));
  const conditionMode = cm === "hasTag" || cm === "notHasTag" ? cm : "always";
  const conditionTagId = str(formData.get("conditionTagId")) || undefined;

  // 配信時刻（HH:MM）任意
  const sendAt = str(formData.get("sendAt"));
  let sendAtHour: number | undefined;
  let sendAtMinute: number | undefined;
  const m = sendAt.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    sendAtHour = Math.min(23, Math.max(0, Number(m[1])));
    sendAtMinute = Math.min(59, Math.max(0, Number(m[2])));
  }

  const stepType = str(formData.get("stepType"));
  const carouselBroadcastId =
    stepType === "carousel" ? str(formData.get("carouselBroadcastId")) || undefined : undefined;

  return {
    delayMinutes: toMinutes(value, unit),
    text: str(formData.get("text")) || (carouselBroadcastId ? "" : "（本文未設定）"),
    imageUrl: str(formData.get("imageUrl")) || undefined,
    autoTagId: str(formData.get("autoTagId")) || undefined,
    conditionMode: (conditionMode === "always" || !conditionTagId ? "always" : conditionMode) as
      | "always"
      | "hasTag"
      | "notHasTag",
    conditionTagId: conditionMode === "always" ? undefined : conditionTagId,
    sendAtHour,
    sendAtMinute,
    carouselBroadcastId,
  };
}

export async function addScenarioStep(scenarioId: string, formData: FormData) {
  const db = getDataProvider();
  const existing = (await db.scenarioSteps.list()).filter((s) => s.scenarioId === scenarioId);
  await db.scenarioSteps.create({
    id: uid("ss"),
    scenarioId,
    order: existing.length,
    ...parseStepFields(formData),
  });
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function updateScenarioStep(stepId: string, scenarioId: string, formData: FormData) {
  await getDataProvider().scenarioSteps.update(stepId, parseStepFields(formData));
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function deleteScenarioStep(stepId: string, scenarioId: string) {
  await getDataProvider().scenarioSteps.remove(stepId);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function moveScenarioStep(stepId: string, scenarioId: string, dir: "up" | "down") {
  const db = getDataProvider();
  const steps = (await db.scenarioSteps.list())
    .filter((s) => s.scenarioId === scenarioId)
    .sort((a, b) => a.order - b.order);
  const idx = steps.findIndex((s) => s.id === stepId);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= steps.length) return;
  await db.scenarioSteps.update(steps[idx].id, { order: steps[swap].order });
  await db.scenarioSteps.update(steps[swap].id, { order: steps[idx].order });
  revalidatePath(`/scenarios/${scenarioId}`);
}

/** 今すぐ配信処理を実行（到達済みステップを送信。実トークン時は実push）。 */
export async function runScenario(scenarioId: string) {
  await processScenarios(getDataProvider(), { scenarioId });
  revalidatePath(`/scenarios/${scenarioId}`);
  revalidatePath("/scenarios");
}
