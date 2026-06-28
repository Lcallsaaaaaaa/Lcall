"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { NAV_GROUPS } from "@/config/nav";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/data/types";
import { canSee } from "@/lib/roles";

export function Sidebar({ badges, role }: { badges?: Record<string, number>; role: Role }) {
  const pathname = usePathname();

  // 役割で見える項目だけに絞り込み、空グループは省く
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => canSee(role, i.key)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-14 items-center border-b border-line px-5">
        <GradientLogo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-faint">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;

                if (!item.ready) {
                  return (
                    <li key={item.key}>
                      <div className="flex cursor-default items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-faint">
                        <Icon className="size-4" />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-faint">
                          準備中
                        </span>
                      </div>
                    </li>
                  );
                }

                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition",
                        active
                          ? "bg-surface-2 font-medium text-ink"
                          : "text-muted hover:bg-surface-2 hover:text-ink"
                      )}
                    >
                      {/* 選択中インジケータ＝ブランドアクセント（限定使用） */}
                      {active && (
                        <span className="gradient-bg absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" />
                      )}
                      <Icon className={cn("size-4", active && "text-brand")} />
                      <span className="flex-1">{item.label}</span>
                      {badges?.[item.key] ? (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium text-white">
                          {badges[item.key] > 99 ? "99+" : badges[item.key]}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-3 text-[11px] text-faint">
        フェーズ0 · ダッシュボード
      </div>
    </aside>
  );
}
