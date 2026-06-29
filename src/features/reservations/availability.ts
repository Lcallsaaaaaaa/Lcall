import type { Reservation, ReservationPage } from "@/lib/data/types";

/**
 * 予約枠の計算（純粋関数）。アプリは日本時間固定（next.config の TZ=Asia/Tokyo）なので、
 * new Date(y,m,d,h,mi) はJSTのローカル時刻として解釈される。
 */
export interface DayOption {
  value: string; // YYYY-MM-DD
  label: string; // 7/1(火)
  weekday: number;
}
export interface SlotOption {
  startISO: string;
  label: string; // HH:MM
  remaining: number;
  available: boolean;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

/** 予約可能な日の一覧（今日〜daysAhead先、休業曜日を除く）。 */
export function dayOptions(page: ReservationPage, now: Date = new Date()): DayOption[] {
  const out: DayOption[] = [];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i <= page.daysAhead; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const wd = d.getDay();
    if (page.closedWeekdays.includes(wd)) continue;
    out.push({ value: ymd(d), label: `${d.getMonth() + 1}/${d.getDate()}(${WD[wd]})`, weekday: wd });
  }
  return out;
}

/** 指定日の時間枠。durationMin はメニューの所要時間（simpleなら page.durationMinutes）。 */
export function daySlots(
  page: ReservationPage,
  dateStr: string,
  durationMin: number,
  existing: Reservation[],
  now: Date = new Date()
): SlotOption[] {
  const p = parseYmd(dateStr);
  if (!p) return [];
  const openMin = page.openHour * 60;
  const closeMin = page.closeHour * 60;
  // 確定予約＋「支払い待ち(pending)で30分以内に作成」のものが枠を占有する（仮押さえ）
  const HOLD_MS = 30 * 60 * 1000;
  const active = existing.filter(
    (r) =>
      r.status === "confirmed" ||
      (r.status === "pending" && now.getTime() - new Date(r.createdAt).getTime() <= HOLD_MS)
  );
  const slots: SlotOption[] = [];
  for (let t = openMin; t + durationMin <= closeMin; t += page.slotMinutes) {
    const h = Math.floor(t / 60);
    const mi = t % 60;
    const startD = new Date(p.y, p.m - 1, p.d, h, mi, 0, 0);
    const startMs = startD.getTime();
    const endMs = startMs + durationMin * 60000;
    const overlap = active.filter((r) => {
      const s = new Date(r.startAt).getTime();
      const e = new Date(r.endAt).getTime();
      return s < endMs && startMs < e; // 区間が重なる
    }).length;
    const remaining = Math.max(0, page.capacity - overlap);
    slots.push({
      startISO: startD.toISOString(),
      label: `${pad(h)}:${pad(mi)}`,
      remaining,
      available: remaining > 0 && startMs > now.getTime(),
    });
  }
  return slots;
}
