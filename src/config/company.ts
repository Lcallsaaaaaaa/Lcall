/**
 * 事業者情報（特定商取引法表記・プライバシーポリシー・利用規約・フッター等で共通利用）。
 *
 * ★ Stripe審査の前に、下記の【要記入】をすべて実在の情報に置き換えてください。
 *   特商法表記は虚偽・空欄があると審査に通りません（個人事業の場合も原則記載が必要）。
 */
export const COMPANY = {
  /** サービス名 */
  serviceName: "LCall",
  /** 公開ページ（LP・ポリシー・運営情報・フッター）で表示する名義。個人名を出さないため屋号表記 */
  displayName: "LCall運営事務局",
  /** 販売事業者名（個人事業のため代表者氏名）。★特定商取引法表記でのみ使用 */
  legalName: "鮫島 真司",
  /** 運営統括責任者。★特定商取引法表記でのみ使用 */
  representative: "鮫島 真司",
  /** 郵便番号（高取=814-0011 で補完。番地と併せてご確認ください） */
  postalCode: "〒814-0011",
  /** 所在地 */
  address: "福岡県福岡市早良区高取2-2-14",
  /** 電話番号 */
  phone: "0120-233-121",
  /** 電話受付時間 */
  phoneHours: "平日 10:00〜18:00（土日祝を除く）",
  /** 問い合わせメール */
  email: "info@lcall.com",
  /** 公開サイトURL（Stripeに登録する事業者URL。メールドメインから補完） */
  siteUrl: "https://lcall.com",
  /** 事業内容 */
  business: "LINE公式アカウントを活用したマーケティングシステム「LCall」の開発・提供および運用サポート",
  /** お申し込み・ログイン導線 */
  loginPath: "/login",
} as const;

/** お支払い・提供条件（特商法/返金ポリシーで共通利用。事業判断に合わせて調整可）。 */
export const COMMERCE_TERMS = {
  /** 月額の課金日に関する説明 */
  monthlyBilling: "月額は、お申し込み日を起点とした毎月の課金サイクルでご請求します。",
  /** AI従量の請求タイミング */
  usageBilling: "AI自動応答の従量料金（1応対あたり）は、当月のご利用分を翌月にご請求します。",
  /** 初期費用の請求タイミング */
  setupBilling: "初期導入サポート費は、お申し込み時にご請求します。",
  /** 提供時期 */
  deliveryTiming: "お申し込み・初期設定の完了後、速やかにご利用いただけます（通常3営業日以内）。",
  /** 解約予告 */
  cancelNotice: "解約は、次回更新日の前日までにお手続きいただくことで、翌期以降のご請求を停止します。",
  /** 動作環境 */
  environment: "最新版の Google Chrome / Microsoft Edge / Safari を推奨します。",
  /** 支払方法 */
  paymentMethod: "クレジットカード決済（Visa / Mastercard / JCB / American Express 等。決済代行：Stripe）",
  /** 決済通貨 */
  currency: "日本円（JPY）",
  /** 税の取り扱い（表示価格が税込か税抜か） */
  taxLabel: "税込",
  /** クレジットカード明細に表示される名称（Stripeの Statement descriptor と一致させること） */
  statementDescriptor: "LCALL",
} as const;

/** フッター等で使う法務ページのリンク一覧。 */
export const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: "/service", label: "サービス紹介" },
  { href: "/legal/company", label: "運営情報" },
  { href: "/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/refund", label: "返金・キャンセルポリシー" },
];
