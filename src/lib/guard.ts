import { redirect } from "next/navigation";
import { getSession } from "./auth";
import type { PlanCode } from "./data/types";
import { getDataProvider } from "./data/provider";
import { canSee, navAllowedByPlan } from "./roles";

/** 現在のプラン（systemSettings の plan）。未設定なら undefined（＝機能ゲートは全許可）。 */
export async function getPlanSetting(): Promise<PlanCode | undefined> {
  const v = (await getDataProvider().systemSettings.list()).find((s) => s.key === "plan")?.value;
  return v === "lite" || v === "standard" || v === "pro" ? v : undefined;
}

/**
 * ログイン必須＋指定 nav キーの権限チェック（サーバー側の本丸）。
 * 未ログイン→/login、役割で不可→/、プランで不可→/。各制限セグメントの layout から呼ぶ。
 * メニュー非表示だけでなくここで弾くので、URL直打ちでもアクセスできない。
 */
export async function requireNav(key: string) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSee(user.role, key)) redirect("/");
  const plan = await getPlanSetting();
  if (!navAllowedByPlan(plan, key)) redirect("/");
  return user;
}
