/**
 * 予約の週間アジェンダ（カレンダー表記）。日本時間固定（TZ=Asia/Tokyo）前提で日付を並べる。
 * ダッシュボードと予約ページ詳細で共用。
 */
export interface AgendaItem {
  id: string;
  startAt: string;
  title: string;
  sub?: string;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const p = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;

export function ReservationAgenda({
  items,
  days = 7,
  startOffset = 0,
}: {
  items: AgendaItem[];
  days?: number;
  startOffset?: number;
}) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byDay = new Map<string, AgendaItem[]>();
  for (const it of items) {
    const k = dayKey(new Date(it.startAt));
    const arr = byDay.get(k) ?? [];
    arr.push(it);
    byDay.set(k, arr);
  }

  const cols = Array.from({ length: days }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + startOffset + i);
    const dayItems = (byDay.get(dayKey(d)) ?? []).sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
    return { d, items: dayItems };
  });

  return (
    <div className="space-y-2">
      {cols.map((c) => (
        <div key={dayKey(c.d)} className="overflow-hidden rounded-lg border border-line">
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink">
            <span>
              {c.d.getMonth() + 1}/{c.d.getDate()}（{WD[c.d.getDay()]}）
            </span>
            <span className="text-muted">{c.items.length > 0 ? `${c.items.length}件` : "—"}</span>
          </div>
          {c.items.length > 0 ? (
            <ul className="divide-y divide-line/60">
              {c.items.map((it) => {
                const t = new Date(it.startAt);
                return (
                  <li key={it.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span className="w-12 shrink-0 tabular-nums text-ink">
                      {p(t.getHours())}:{p(t.getMinutes())}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink">{it.title}</span>
                    {it.sub && <span className="shrink-0 text-xs text-muted">{it.sub}</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-1.5 text-xs text-faint">予約なし</p>
          )}
        </div>
      ))}
    </div>
  );
}
