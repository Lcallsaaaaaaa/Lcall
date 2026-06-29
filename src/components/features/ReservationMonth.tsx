import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/** 予約の月表示カレンダー（日本時間固定）。日セルに時刻＋件名を表示。月送りは ?cal=YYYY-MM。 */
export interface MonthItem {
  id: string;
  startAt: string;
  title: string;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (s: string) => {
  const d = new Date(s);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ReservationMonth({
  items,
  ym,
  basePath,
}: {
  items: MonthItem[];
  ym: string; // YYYY-MM
  basePath: string;
}) {
  const [y, m] = ym.split("-").map(Number); // m: 1-12
  const startWd = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;

  const byDay = new Map<number, MonthItem[]>();
  for (const it of items) {
    const d = new Date(it.startAt);
    if (d.getFullYear() === y && d.getMonth() === m - 1) {
      const arr = byDay.get(d.getDate()) ?? [];
      arr.push(it);
      byDay.set(d.getDate(), arr);
    }
  }

  const cells: ({ day: number; items: MonthItem[] } | null)[] = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, items: (byDay.get(d) ?? []).sort((a, b) => (a.startAt < b.startAt ? -1 : 1)) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const now = new Date();
  const isToday = (d: number) => now.getFullYear() === y && now.getMonth() === m - 1 && now.getDate() === d;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={`${basePath}?cal=${prev}`} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="前の月">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="text-sm font-medium text-ink">{y}年{m}月</span>
        <Link href={`${basePath}?cal=${next}`} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="次の月">
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {WD.map((w, i) => (
          <div key={w} className={`bg-surface-2 py-1 text-center text-xs font-medium ${i === 0 ? "text-danger" : i === 6 ? "text-brand" : "text-muted"}`}>
            {w}
          </div>
        ))}
        {cells.map((c, i) => (
          <div key={i} className="min-h-[68px] bg-surface p-1 align-top">
            {c && (
              <>
                <div className={`text-right text-xs ${isToday(c.day) ? "font-bold text-brand" : "text-muted"}`}>{c.day}</div>
                <div className="mt-0.5 space-y-0.5">
                  {c.items.slice(0, 3).map((it) => (
                    <div key={it.id} className="truncate rounded bg-brand/10 px-1 py-0.5 text-[11px] leading-tight text-ink">
                      {hhmm(it.startAt)} {it.title}
                    </div>
                  ))}
                  {c.items.length > 3 && <div className="text-[10px] text-muted">＋{c.items.length - 3}件</div>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
