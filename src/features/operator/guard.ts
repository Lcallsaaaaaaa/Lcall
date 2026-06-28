import { notFound, redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth";
import { isControlPlane } from "@/lib/operator";

/**
 * 運営コンソール（`(operator)`）の保護。
 * - コントロールプレーンでないデプロイでは 404（クライアント配布物では露出しない）。
 * - 未ログインは /login、owner 以外も /login（運営者のみ）。
 */
export async function requireOperator(): Promise<SessionUser> {
  if (!isControlPlane()) notFound();
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/login");
  return user;
}
