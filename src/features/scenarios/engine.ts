/** シナリオ配信の純粋ロジック（登録からの経過時間で配信判定）。 */

export function elapsedMinutes(fromISO: string, now: Date): number {
  return (now.getTime() - new Date(fromISO).getTime()) / 60000;
}

export interface StepSchedule {
  delayMinutes: number;
  sendAtHour?: number;
  sendAtMinute?: number;
}

/**
 * ステップの実際の配信予定時刻。
 * 「登録 + 遅延」を基準とし、配信時刻(HH:MM)が指定されていればその日の HH:MM に合わせる。
 */
export function stepDueAt(registeredAtISO: string, step: StepSchedule): Date {
  const base = new Date(new Date(registeredAtISO).getTime() + step.delayMinutes * 60000);
  if (step.sendAtHour == null) return base;
  const d = new Date(base);
  d.setHours(step.sendAtHour, step.sendAtMinute ?? 0, 0, 0);
  return d;
}

/**
 * 配信すべきステップ＝「配信予定時刻に到達」かつ「未処理」。
 * delayMinutes 0 は追加時挨拶。
 */
export function dueSteps<T extends { id: string } & StepSchedule>(
  steps: T[],
  registeredAtISO: string,
  now: Date,
  deliveredStepIds: Set<string>
): T[] {
  return steps.filter(
    (s) => !deliveredStepIds.has(s.id) && now.getTime() >= stepDueAt(registeredAtISO, s).getTime()
  );
}

/** ステップの配信条件（タグ分岐）を評価。 */
export function conditionMet(
  mode: "always" | "hasTag" | "notHasTag" | undefined,
  conditionTagId: string | undefined,
  hasTag: boolean
): boolean {
  if (!mode || mode === "always" || !conditionTagId) return true;
  return mode === "hasTag" ? hasTag : !hasTag;
}

/** 分を「N日/N時間/N分」表記に。 */
export function formatDelay(min: number): string {
  if (min <= 0) return "追加時（即時）";
  if (min % 1440 === 0) return `${min / 1440}日後`;
  if (min % 60 === 0) return `${min / 60}時間後`;
  return `${min}分後`;
}

/** 遅延＋配信時刻の表示。 */
export function formatSchedule(min: number, hour?: number, minute?: number): string {
  const base = formatDelay(min);
  if (hour == null) return base;
  const hm = `${String(hour).padStart(2, "0")}:${String(minute ?? 0).padStart(2, "0")}`;
  return min <= 0 ? `追加時 ${hm}` : `${base.replace("（即時）", "")} ${hm}`;
}
