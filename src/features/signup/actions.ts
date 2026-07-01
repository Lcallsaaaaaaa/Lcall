"use server";

import { redirect } from "next/navigation";
import { ensureSignupCommission } from "@/features/operator/affiliate";
import { provisionTenant } from "@/features/operator/provision";
import { getDataProvider } from "@/lib/data/provider";
import type { PlanCode } from "@/lib/data/types";
import { isControlPlane } from "@/lib/operator";
import { normalizeSlug, validateSlug } from "@/lib/slug";
import { createSignupCheckoutUrl } from "./checkout";

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function parsePlan(v: FormDataEntryValue | null): PlanCode {
  const s = String(v ?? "");
  return s === "lite" || s === "standard" || s === "pro" ? s : "standard";
}

/** 入力を保持しつつ申込ページへ差し戻す（エラー表示）。 */
function backWithError(reason: string, fields: Record<string, string>): never {
  const q = new URLSearchParams({ err: reason });
  for (const [k, v] of Object.entries(fields)) if (v) q.set(k, v);
  redirect(`/signup?${q.toString()}`);
}

/**
 * 公開申込（直販＋アフィリ任意）。送信→台帳登録→自動プロビジョニング→（Stripeあれば）決済へ。
 * コントロールプレーン専用（テナントアプリでは呼ばれない）。
 */
export async function submitSignup(formData: FormData) {
  if (!isControlPlane()) throw new Error("申込はコントロールプレーンでのみ受け付けます");

  const db = getDataProvider();
  const name = str(formData.get("name"));
  const slug = normalizeSlug(str(formData.get("slug")) || name);
  const email = str(formData.get("contactEmail")).toLowerCase();
  const password = str(formData.get("password"));
  const plan = parsePlan(formData.get("plan"));
  const affCode = str(formData.get("aff"));

  const keepFields = { name, slug, contactEmail: email, plan, aff: affCode };

  // --- バリデーション ---
  if (!name) backWithError("事業者名を入力してください", keepFields);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    backWithError("メールアドレスを正しく入力してください", keepFields);
  if (password.length < 8) backWithError("パスワードは8文字以上にしてください", keepFields);
  const sv = validateSlug(slug);
  if (!sv.ok) backWithError(sv.reason ?? "サブドメインが不正です", keepFields);
  const accounts = await db.clientAccounts.list();
  if (accounts.some((c) => c.slug === slug))
    backWithError("このサブドメインは既に使われています", keepFields);

  // --- アフィリコード解決（任意・active のみ） ---
  let affiliateId: string | undefined;
  if (affCode) {
    const code = affCode.toLowerCase();
    const aff = (await db.affiliates.list()).find(
      (a) => a.code.toLowerCase() === code && a.status === "active"
    );
    affiliateId = aff?.id; // 無効コードは無視（直販扱い）
  }

  // --- 台帳に登録（trial） ---
  const id = uid("ca");
  const now = new Date().toISOString();
  await db.clientAccounts.create({
    id,
    name,
    slug,
    contactEmail: email,
    plan,
    status: "trial",
    affiliateId,
    createdAt: now,
  });
  if (affiliateId) {
    const aff = await db.affiliates.get(affiliateId);
    if (aff)
      await db.affiliateReferrals.create({
        id: uid("ref"),
        affiliateId,
        code: aff.code,
        landingAt: now,
        clientAccountId: id,
        convertedAt: now,
        status: "converted",
      });
  }

  // --- 自動プロビジョニング（専用DB＋オーナー作成＝即開通） ---
  await provisionTenant({ clientAccountId: id, ownerName: name, password });

  // --- 決済（Stripeあり＝サブスクへ。なし＝トライアルのまま完了画面） ---
  const client = await db.clientAccounts.get(id);
  const checkoutUrl = client ? await createSignupCheckoutUrl(client) : null;
  if (checkoutUrl) {
    // 初回報酬は決済確定（webhook）で計上（冪等）。ここでは作らない。
    redirect(checkoutUrl);
  }

  // Stripe未設定（トライアル運用）：この場で初回報酬を計上（紹介経由のみ・冪等）。
  if (affiliateId) await ensureSignupCommission(id);
  redirect(`/signup/done?ca=${id}`);
}
