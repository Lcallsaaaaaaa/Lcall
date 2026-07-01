import type { PlanCode } from "@/lib/data/types";

/** プラン別に出し分ける機能のキー。 */
export type PlanFeatureKey =
  | "broadcast"
  | "scenario"
  | "forms"
  | "chat"
  | "aiCharacter"
  | "richMenu"
  | "reservations"
  | "surveys"
  | "lp"
  | "distribution"
  | "adCodes";

export interface PlanFeatureDef {
  key: PlanFeatureKey;
  label: string;
  /** これから実装予定（表示は「準備中」） */
  comingSoon?: boolean;
}

/** 比較表に表示する機能の定義（配列順＝表示順）。 */
export const PLAN_FEATURES: PlanFeatureDef[] = [
  { key: "broadcast", label: "一斉・カルーセル配信" },
  { key: "scenario", label: "シナリオ配信（ステップ）" },
  { key: "forms", label: "申込フォーム" },
  { key: "chat", label: "チャット対応・タグ・定型文" },
  { key: "aiCharacter", label: "AI自動応答" },
  { key: "richMenu", label: "リッチメニュー" },
  { key: "reservations", label: "予約システム" },
  { key: "surveys", label: "アンケート" },
  { key: "lp", label: "LP管理" },
  { key: "distribution", label: "分散登録URL" },
  { key: "adCodes", label: "広告コード＋CV計測" },
];

export interface PlanDef {
  code: PlanCode;
  name: string;
  /** 接続できるLINE公式アカウント数（有効数の技術的上限・§10） */
  lineLimit: number;
  /** 追加できるスタッフ（db.users＝admin/staff等）の上限。初期オーナー(env)は別枠で常に可。 */
  staffLimit: number;
  /** プラン別の月額料金（円） */
  monthlyFee: number;
  /** 月間の無料AI応答回数（プランに含む・毎月リセット）。これを超えると購入残高(aiCredits)を消費し、無ければ停止。 */
  aiMonthlyLimit: number;
  /** このプランに含まれる機能 */
  features: PlanFeatureKey[];
  /**
   * 紹介（アフィリエイト）報酬率（月額に対する割合・継続）。
   * 方針：Standard 以上のみ支払い対象。Lite は薄利のため 0（対象外）。
   * ※アフィリ報酬の計上ロジック自体は今後実装（ここは料率の単一情報源）。
   */
  affiliateRate: number;
}

/**
 * 料金プラン。UTAGE（月額¥21,670）より安い「低コスト代替」ポジション。
 * 上位の Pro でも ¥19,800 < UTAGE。アフィリは Standard 以上のみ（月額の15%継続）、Lite は対象外（薄利保護）。
 */
export const PLANS: Record<PlanCode, PlanDef> = {
  lite: {
    code: "lite",
    name: "Lite",
    lineLimit: 5,
    staffLimit: 3,
    monthlyFee: 9800,
    aiMonthlyLimit: 500,
    features: ["broadcast", "scenario", "forms", "chat", "aiCharacter", "richMenu"],
    affiliateRate: 0,
  },
  standard: {
    code: "standard",
    name: "Standard",
    lineLimit: 20,
    staffLimit: 3,
    monthlyFee: 14800,
    aiMonthlyLimit: 500,
    features: [
      "broadcast",
      "scenario",
      "forms",
      "chat",
      "aiCharacter",
      "richMenu",
      "reservations",
      "surveys",
      "lp",
      "distribution",
    ],
    affiliateRate: 0.15,
  },
  pro: {
    code: "pro",
    name: "Pro",
    lineLimit: 50,
    staffLimit: 3,
    monthlyFee: 19800,
    aiMonthlyLimit: 500,
    features: [
      "broadcast",
      "scenario",
      "forms",
      "chat",
      "aiCharacter",
      "richMenu",
      "reservations",
      "surveys",
      "lp",
      "distribution",
      "adCodes",
    ],
    affiliateRate: 0.15,
  },
};

export interface AddonDef {
  key: string;
  label: string;
  /** 価格（円） */
  amount: number;
  /** true=月額／false=スポット（一回） */
  recurring: boolean;
  /** 紹介（アフィリ）報酬率。対象外は 0。 */
  affiliateRate: number;
  description?: string;
}

/**
 * 任意オプション（基本プランへの追加）。
 * - 設定代行・データ分析サポートは紹介報酬の対象外（役務収益＝全額自社）。
 * - サポートプランのみアフィリ20%対象。
 */
export const ADDONS: AddonDef[] = [
  {
    key: "support_plan",
    label: "サポートプラン",
    amount: 15000,
    recurring: true,
    affiliateRate: 0.2,
    description: "電話・運用相談などの継続サポート",
  },
  {
    key: "data_analysis",
    label: "データ分析サポート",
    amount: 30000,
    recurring: true,
    affiliateRate: 0,
    description: "配信・予約データの分析代行・レポート（アフィリ対象外）",
  },
  {
    key: "setup_assist",
    label: "設定代行（スポット）",
    amount: 10000,
    recurring: false,
    affiliateRate: 0,
    description: "途中の設定・構築を個別代行（アフィリ対象外・1回）",
  },
];

/** 指定プランに機能が含まれるか（将来のナビ/ルート出し分けにも利用可能）。 */
export function planHasFeature(plan: PlanCode, key: PlanFeatureKey): boolean {
  return PLANS[plan].features.includes(key);
}

/** プラン別の月額（円）を返す。 */
export function planMonthlyFee(plan: PlanCode): number {
  return PLANS[plan].monthlyFee;
}

/** プラン別の紹介報酬率（Standard以上のみ>0）。アフィリ計上の単一情報源。 */
export function planAffiliateRate(plan: PlanCode): number {
  return PLANS[plan].affiliateRate;
}

/** プラン別の月間AI自動応答上限（プランに含む・超過で停止）。 */
export function planAiMonthlyLimit(plan: PlanCode): number {
  return PLANS[plan].aiMonthlyLimit;
}

/** 将来拡張の上限（§10）。Pro=50 のため headroom を持たせる。 */
export const MAX_LINE_ACCOUNTS_FUTURE = 100;

// ===== 代理店方式（多段アフィリ）の料率 =====
// 方針：合計上限＝代理店(agency)率で固定。配下(member)が取る分を差し引いた残りが
// 上位（代理店）へのオーバーライド。よって1ネットワークの合計は常に agency 率以内＝薄利保護。
export type AffiliateRankCode = "agency" | "member";
export interface AffiliateRankDef {
  code: AffiliateRankCode;
  name: string;
  /** 初回報酬率（初期費に対する割合） */
  signupRate: number;
  /** 継続報酬率（月額に対する割合） */
  recurringRate: number;
}
export const AFFILIATE_RANKS: Record<AffiliateRankCode, AffiliateRankDef> = {
  agency: { code: "agency", name: "代理店", signupRate: 0.3, recurringRate: 0.25 },
  member: { code: "member", name: "一般", signupRate: 0.2, recurringRate: 0.2 },
};
/** 料率の上限＝代理店率（代理店が配下に設定できる上限・ネットワーク合計の上限）。 */
export const AFFILIATE_RATE_CAP = {
  signup: AFFILIATE_RANKS.agency.signupRate,
  recurring: AFFILIATE_RANKS.agency.recurringRate,
} as const;

/** 料金（§5 契約・請求管理）。月額はティア別（PLANS）に持つ。 */
export const PRICING = {
  /** 初期導入サポート費（円）。UTAGEは初期費0なので低めに設定（納品型の一括構築費）。 */
  setupFee: 50000,
  /** 紹介（アフィリ）初回報酬率＝初期費に対する割合。Standard以上の紹介のみ対象。 */
  affiliateSetupRate: 0.3,
  /** AI自動応答の従量単価（円／1応対） */
  aiReplyUnitFee: 3,
  /** 支払い失敗後の配信停止までの日数 */
  suspendAfterDays: 14,
  /** 支払い失敗後のデータ削除対象までの日数 */
  purgeAfterDays: 30,
} as const;
