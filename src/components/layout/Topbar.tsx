import { LogOut } from "lucide-react";
import { GradientLogo } from "@/components/ui/GradientLogo";
import type { SessionUser } from "@/lib/auth";

export function Topbar({ user }: { user: SessionUser }) {
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
      {/* モバイルはロゴ、デスクトップはサイドバーにロゴがあるので控えめ表示 */}
      <div className="md:hidden">
        <GradientLogo size="sm" />
      </div>
      <div className="hidden text-sm text-muted md:block">管理画面</div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink">
            {initial}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-ink">{user.name}</p>
            <p className="text-xs text-muted">{user.email}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
            title="ログアウト"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </form>
      </div>
    </header>
  );
}
