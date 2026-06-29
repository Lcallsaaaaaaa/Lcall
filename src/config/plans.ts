import type { PlanCode } from "@/lib/data/types";

/** プラン別に出し分ける機能のキー。 */
export type PlanFeatureKey =
  | "broadcast"
  | "forms"
  | "chat"
  | "reservations"
  | "aiCharacter"
  | "points";

export interface PlanFeatureDef {
  key: PlanFeatureKey;
  label: string;
  /** これから実装予定（表示は「準備中」） */
  comingSoon?: boolean;
}

/** 比較表に表示する機能の定義（配列順＝表示順）。 */
export const PLAN_FEATURES: PlanFeatureDef[] = [
  { key: "broadcast", label: "一斉・ステップ・カルーセル配信" },
  { key: "forms", label: "申込フォーム・アンケート" },
  { key: "chat", label: "チャット対応・タグ管理" },
  { key: "reservations", label: "予約システム" },
  { key: "aiCharacter", label: "AIキャラ自動応答" },
  { key: "points", label: "ポイントシステム", comingSoon: true },
];

export interface PlanDef {
  code: PlanCode;
  name: string;
  /** 接続できるLINE公式アカウント数（§10） */
  lineLimit: number;
  /** プラン別の月額料金（円） */
  monthlyFee: number;
  /** このプランに含まれる機能 */
  features: PlanFeatureKey[];
}

/** 初期プラン（§10）。将来的に最大50まで拡張可能な設計。月額・機能はティア別。 */
export const PLANS: Record<PlanCode, PlanDef> = {
  lite: {
    code: "lite",
    name: "Lite",
    lineLimit: 5,
    monthlyFee: 9800,
    features: ["broadcast", "forms", "chat"],
  },
  standard: {
    code: "standard",
    name: "Standard",
    lineLimit: 10,
    monthlyFee: 15000,
    features: ["broadcast", "forms", "chat", "reservations", "aiCharacter"],
  },
  pro: {
    code: "pro",
    name: "Pro",
    lineLimit: 15,
    monthlyFee: 25000,
    features: ["broadcast", "forms", "chat", "reservations", "aiCharacter", "points"],
  },
};

/** 指定プランに機能が含まれるか（将来のナビ/ルート出し分けにも利用可能）。 */
export function planHasFeature(plan: PlanCode, key: PlanFeatureKey): boolean {
  return PLANS[plan].features.includes(key);
}

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
