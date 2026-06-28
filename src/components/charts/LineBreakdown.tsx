import { StatusBadge } from "@/components/ui/StatusBadge";
import type { LineBreakdownRow } from "@/features/dashboard/metrics";

/** LINE別登録数（横棒）。バーは落ち着いたインディゴで統一（過度な装飾を避ける）。 */
export function LineBreakdown({ rows }: { rows: LineBreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.id}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-ink">{r.name}</span>
              <StatusBadge status={r.status} />
            </div>
            <span className="shrink-0 tabular-nums text-muted">
              {r.count.toLocaleString()}人
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, backgroundColor: "#515bd4" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
