import type { PlanCode } from "@/lib/data/types";

export interface PlanDef {
  code: PlanCode;
  name: string;
  /** 接続できるLINE公式アカウント数（§10） */
  lineLimit: number;
  /** プラン別の月額料金（円） */
  monthlyFee: number;
}

/** 初期プラン（§10）。将来的に最大50まで拡張可能な設計。月額はティア別。 */
export const PLANS: Record<PlanCode, PlanDef> = {
  lite: { code: "lite", name: "Lite", lineLimit: 5, monthlyFee: 9800 },
  standard: { code: "standard", name: "Standard", lineLimit: 10, monthlyFee: 15000 },
  pro: { code: "pro", name: "Pro", lineLimit: 15, monthlyFee: 25000 },
};

/** プラン別の月額（円）を返す。 */
export function planMonthlyFee(plan: PlanCode): number {
  return PLANS[plan].monthlyFee;
}

/** 将来拡張の上限（§10） */
export const MAX_LINE_ACCOUNTS_FUTURE = 50;

/** 料金（§5 契約・請求管理）。月額はティア別（PLANS）に持つ。 */
export const PRICING = {
  /** 初期導入サポート費（円） */
  setupFee: 50000,
  /** AI自動応答の従量単価（円／1応対） */
  aiReplyUnitFee: 3,
  /** 支払い失敗後の配信停止までの日数 */
  suspendAfterDays: 14,
  /** 支払い失敗後のデータ削除対象までの日数 */
  purgeAfterDays: 30,
} as const;
