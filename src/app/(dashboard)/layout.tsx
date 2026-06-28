import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { totalUnread } from "@/features/chat/queries";
import { getSession } from "@/lib/auth";
import { isControlPlane } from "@/lib/operator";

/** 認証必須レイアウト。未ログインは /login へ。Sidebar + Topbar の Stripe風シェル。 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  // 運営コンソール（コントロールプレーン）デプロイではクライアント画面を出さず /operator へ。
  if (isControlPlane()) redirect("/operator");

  const unread = await totalUnread();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar badges={{ chat: unread }} role={user.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {process.env.LCALL_DEMO === "true" && (
          <div className="shrink-0 border-b border-[#f6d3e4] bg-[#fdf2f8] px-4 py-1.5 text-center text-xs font-medium text-brand">
            これはデモ環境です。自由にお試しください（データは定期的にリセットされ、実際の送信・課金は行われません）。
          </div>
        )}
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
