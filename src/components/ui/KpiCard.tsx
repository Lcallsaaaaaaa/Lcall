import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

interface KpiCardProps {
  label: string;
  value: string;
  /** 補足（前月比など） */
  sub?: string;
  icon: LucideIcon;
  /** 重要KPI: アイコンと左罫をブランドアクセントにする（限定使用） */
  important?: boolean;
}

export function KpiCard({ label, value, sub, icon: Icon, important }: KpiCardProps) {
  return (
    <Card accentRail={important} className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            important ? "gradient-bg text-white" : "bg-surface-2 text-muted"
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}
