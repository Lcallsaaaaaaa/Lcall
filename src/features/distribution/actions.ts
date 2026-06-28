"use server";

import { revalidatePath } from "next/cache";
import { getDataProvider } from "@/lib/data/provider";
import type { DistributionStrategy } from "@/lib/data/types";
import { selectAccount } from "./engine";
import { getCandidates, getStrategy } from "./queries";

function parseStrategy(v: FormDataEntryValue | null): DistributionStrategy {
  const s = String(v ?? "");
  return s === "random" || s === "even" || s === "weighted" ? s : "weighted";
}

export async function setStrategy(formData: FormData) {
  const strategy = parseStrategy(formData.get("strategy"));
  const db = getDataProvider();
  const settings = await db.systemSettings.list();
  const existing = settings.find((s) => s.key === "distribution_strategy");
  if (existing) {
    await db.systemSettings.update(existing.id, { value: strategy });
  } else {
    await db.systemSettings.create({
      id: `set_${Date.now()}`,
      key: "distribution_strategy",
      value: strategy,
    });
  }
  revalidatePath("/distribution");
}

/** 実際にLINEへは飛ばさず、現在の方式で1件の振り分けを記録（動作確認用）。 */
export async function simulateDistribution() {
  const db = getDataProvider();
  const [candidates, strategy] = await Promise.all([getCandidates(), getStrategy()]);
  const chosen = selectAccount(candidates, strategy);
  if (chosen) {
    await db.distributionLogs.create({
      id: `dl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      assignedLineAccountId: chosen.id,
      strategy,
      createdAt: new Date().toISOString(),
    });
  }
  revalidatePath("/distribution");
}
