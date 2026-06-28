import { LogOut } from "lucide-react";
import Link from "next/link";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { OPERATOR_NAV } from "@/config/operator-nav";
import { requireOperator } from "@/features/operator/guard";

// 環境変数(LCALL_CONTROL_PLANE)とセッションを毎リクエスト評価する（ビルド時に404を焼かない）。
export const dynamic = "force-dynamic";

/** 運営コンソール（コントロールプレーン）のシェル。LCALL_CONTROL_PLANE=true のみ有効。 */
export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOperator();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-line px-5">
          <GradientLogo />
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">運営</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-faint">
            コントロールプレーン
          </p>
          <ul className="space-y-0.5">
            {OPERATOR_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line px-4 py-3 text-[11px] text-faint">運営管理コンソール</div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
          <div className="text-sm text-muted">全クライアント一括管理</div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium text-ink">{user.name}</p>
              <p className="text-xs text-muted">{user.email}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
