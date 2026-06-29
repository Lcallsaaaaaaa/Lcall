import { type PlanFeatureKey, planHasFeature } from "@/config/plans";
import type { PlanCode, Role } from "./data/types";

/** 役割の表示名。 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "オーナー（管理者）",
  admin: "運用担当",
  staff: "チャット対応",
};

/** スタッフ作成/編集のロール選択肢（owner は誤付与防止のため末尾）。 */
export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: ROLE_LABELS.admin },
  { value: "staff", label: ROLE_LABELS.staff },
  { value: "owner", label: ROLE_LABELS.owner },
];

/**
 * navキー → 閲覧/操作を許可する役割。未定義キーは owner のみ（fail-closed）。
 * - owner: 全部（分析・契約/請求・スタッフ管理を含む）
 * - admin（運用担当）: 集客/顧客/配信/獲得（分析・お金・スタッフ管理は不可）
 * - staff（チャット対応）: チャットのみ（受信箱に顧客情報・タグ・定型文・カルーセルを内蔵）
 */
const ACCESS: Record<string, Role[]> = {
  dashboard: ["owner", "admin"],
  analytics: ["owner"],
  billing: ["owner"],
  staff: ["owner"],
  settings: ["owner"],
  line: ["owner", "admin"],
  "rich-menus": ["owner", "admin"],
  distribution: ["owner", "admin"],
  "ad-codes": ["owner", "admin"],
  "ai-characters": ["owner", "admin"],
  broadcasts: ["owner", "admin"],
  scenarios: ["owner", "admin"],
  carousel: ["owner", "admin"],
  forms: ["owner", "admin"],
  surveys: ["owner", "admin"],
  lp: ["owner", "admin"],
  media: ["owner", "admin"],
  friends: ["owner", "admin"],
  chat: ["owner", "admin", "staff"],
  templates: ["owner", "admin"],
  tags: ["owner", "admin"],
};

/** この役割が当該navキー（画面/機能）を見られるか。 */
export function canSee(role: Role, key: string): boolean {
  const roles = ACCESS[key];
  return roles ? roles.includes(role) : role === "owner";
}

/**
 * navキー → 必要なプラン機能。ここに無いキーは全プランで利用可（コア機能）。
 * 料率/機能の単一情報源は config/plans.ts（PLANS[].features）。
 */
const NAV_FEATURE: Record<string, PlanFeatureKey> = {
  reservations: "reservations",
  surveys: "surveys",
  lp: "lp",
  distribution: "distribution",
  "ad-codes": "adCodes",
};

/**
 * 現在のプランで当該navキーが使えるか。
 * plan が undefined（プラン未設定＝不明）のときは全表示＝誤ロック防止。
 */
export function navAllowedByPlan(plan: PlanCode | undefined, key: string): boolean {
  if (!plan) return true;
  const feature = NAV_FEATURE[key];
  return feature ? planHasFeature(plan, feature) : true;
}
