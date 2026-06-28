import { getDataProvider } from "@/lib/data/provider";
import type { Scenario, ScenarioStep } from "@/lib/data/types";
import { formatSchedule } from "./engine";

export interface ScenarioRow extends Scenario {
  stepCount: number;
  deliveryCount: number;
  targetTagName?: string;
}

export async function listScenarios(): Promise<ScenarioRow[]> {
  const db = getDataProvider();
  const [scenarios, steps, deliveries, tags] = await Promise.all([
    db.scenarios.list(),
    db.scenarioSteps.list(),
    db.scenarioDeliveries.list(),
    db.tags.list(),
  ]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const stepCount = new Map<string, number>();
  for (const s of steps) stepCount.set(s.scenarioId, (stepCount.get(s.scenarioId) ?? 0) + 1);
  const delCount = new Map<string, number>();
  for (const d of deliveries) if (d.sent) delCount.set(d.scenarioId, (delCount.get(d.scenarioId) ?? 0) + 1);

  return scenarios
    .map((s) => ({
      ...s,
      stepCount: stepCount.get(s.id) ?? 0,
      deliveryCount: delCount.get(s.id) ?? 0,
      targetTagName: s.targetTagId ? tagName.get(s.targetTagId) : undefined,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export interface ScenarioStepView extends ScenarioStep {
  delayLabel: string;
  autoTagName?: string;
  conditionLabel?: string;
  carouselTitle?: string;
  sentCount: number;
}

export interface ScenarioDetail {
  scenario: Scenario;
  steps: ScenarioStepView[];
  targetTagName?: string;
  eligibleCount: number;
  totalSent: number;
}

export async function getScenario(id: string): Promise<ScenarioDetail | null> {
  const db = getDataProvider();
  const scenario = await db.scenarios.get(id);
  if (!scenario) return null;
  const [steps, deliveries, tags, friends, friendTags, broadcasts] = await Promise.all([
    db.scenarioSteps.list(),
    db.scenarioDeliveries.list(),
    db.tags.list(),
    db.friends.list(),
    db.friendTags.list(),
    db.broadcasts.list(),
  ]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const broadcastTitle = new Map(broadcasts.map((b) => [b.id, b.title]));
  const sentByStep = new Map<string, number>();
  for (const d of deliveries) {
    if (d.scenarioId === id && d.sent) sentByStep.set(d.stepId, (sentByStep.get(d.stepId) ?? 0) + 1);
  }

  let eligibleCount = friends.filter((f) => f.status === "active").length;
  if (scenario.targetTagId) {
    const taggedFriendIds = new Set(
      friendTags.filter((ft) => ft.tagId === scenario.targetTagId).map((ft) => ft.friendId)
    );
    eligibleCount = friends.filter((f) => f.status === "active" && taggedFriendIds.has(f.id)).length;
  }

  return {
    scenario,
    steps: steps
      .filter((s) => s.scenarioId === id)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        ...s,
        delayLabel: formatSchedule(s.delayMinutes, s.sendAtHour, s.sendAtMinute),
        autoTagName: s.autoTagId ? tagName.get(s.autoTagId) : undefined,
        conditionLabel:
          s.conditionMode && s.conditionMode !== "always" && s.conditionTagId
            ? `「${tagName.get(s.conditionTagId) ?? "タグ"}」を${s.conditionMode === "hasTag" ? "持つ人のみ" : "持たない人のみ"}`
            : undefined,
        carouselTitle: s.carouselBroadcastId ? broadcastTitle.get(s.carouselBroadcastId) : undefined,
        sentCount: sentByStep.get(s.id) ?? 0,
      })),
    targetTagName: scenario.targetTagId ? tagName.get(scenario.targetTagId) : undefined,
    eligibleCount,
    totalSent: deliveries.filter((d) => d.scenarioId === id).length,
  };
}
