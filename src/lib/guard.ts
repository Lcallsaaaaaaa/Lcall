import { redirect } from "next/navigation";
import { getSession } from "./auth";
import { canSee } from "./roles";

/**
 * ログイン必須＋指定 nav キーの権限チェック（サーバー側の本丸）。
 * 未ログイン→/login、権限なし→/（ダッシュボード）。各制限セグメントの layout から呼ぶ。
 * メニュー非表示だけでなくここで弾くので、URL直打ちでもアクセスできない。
 */
export async function requireNav(key: string) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSee(user.role, key)) redirect("/");
  return user;
}
