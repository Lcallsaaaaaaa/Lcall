"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PLANS } from "@/config/plans";
import { hashPassword } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import type { Role, User } from "@/lib/data/types";
import { requireNav } from "@/lib/guard";
import { getCurrentPlan } from "@/features/line-accounts/queries";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function parseRole(v: FormDataEntryValue | null): Role {
  const s = String(v ?? "");
  return s === "owner" || s === "admin" || s === "staff" ? s : "staff";
}
function uid(): string {
  return `usr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** スタッフ追加（オーナーのみ）。メール＋名前＋役割＋初期パスワード。 */
export async function createStaff(formData: FormData) {
  await requireNav("staff");
  const email = str(formData.get("email")).toLowerCase();
  const password = str(formData.get("password"));
  if (!email || !password) redirect("/staff?error=missing");

  const db = getDataProvider();
  const existing = await db.users.list();
  if (existing.some((u) => u.email.trim().toLowerCase() === email)) {
    redirect("/staff?error=dup");
  }
  // プラン別のスタッフ上限（全プラン3）。初期オーナー(env)は別枠。
  const limit = PLANS[await getCurrentPlan()].staffLimit;
  if (existing.length >= limit) {
    redirect("/staff?error=limit");
  }
  await db.users.create({
    id: uid(),
    email,
    name: str(formData.get("name")) || email,
    role: parseRole(formData.get("role")),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/staff");
  redirect("/staff?ok=created");
}

/** スタッフ更新（名前・役割、パスワードは入力時のみ再設定）。オーナーのみ。 */
export async function updateStaff(id: string, formData: FormData) {
  await requireNav("staff");
  const name = str(formData.get("name"));
  const password = str(formData.get("password"));
  const patch: Partial<User> = { role: parseRole(formData.get("role")) };
  if (name) patch.name = name;
  if (password) patch.passwordHash = hashPassword(password);
  await getDataProvider().users.update(id, patch);
  revalidatePath("/staff");
  redirect("/staff?ok=updated");
}

/** スタッフ削除。オーナーのみ。 */
export async function deleteStaff(id: string) {
  await requireNav("staff");
  await getDataProvider().users.remove(id);
  revalidatePath("/staff");
  redirect("/staff?ok=deleted");
}
