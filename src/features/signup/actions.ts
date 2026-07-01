"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import type { PlanCode } from "@/lib/data/types";
import { isControlPlane } from "@/lib/operator";
import { normalizeSlug, validateSlug } from "@/lib/slug";
import { stripeEnabled } from "@/lib/stripe";
import { createSignupCheckoutUrl } from "./checkout";

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
/** 平文を scrypt ハッシュ（`scrypt:salt:hash`）。オーナーPWを一時保管する用。 */
function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${crypto.scryptSync(plain, salt, 64).toString("hex")}`;
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

  // --- 決済必須：無料開放しない。Stripe未設定なら受付停止（空DB量産・悪用防止） ---
  if (!stripeEnabled())
    backWithError("現在お申し込みを受け付けていません（決済準備中）。運営にお問い合わせください。", keepFields);

  // --- 台帳に「決済待ち(pending)」で登録。オーナーPWはハッシュで一時保管（発行時に使用・平文は保持しない） ---
  const id = uid("ca");
  const now = new Date().toISOString();
  await db.clientAccounts.create({
    id,
    name,
    slug,
    contactEmail: email,
    plan,
    status: "pending",
    affiliateId,
    ownerName: name,
    ownerPasswordHash: hashPassword(password),
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

  // --- 決済へ（サブスクCheckout）。決済確定のwebhookで専用DB作成＋開通＋初回報酬（冪等） ---
  const client = await db.clientAccounts.get(id);
  const checkoutUrl = client ? await createSignupCheckoutUrl(client) : null;
  if (!checkoutUrl)
    backWithError("決済ページを開始できませんでした。時間をおいて再度お試しください。", keepFields);
  redirect(checkoutUrl);
}
