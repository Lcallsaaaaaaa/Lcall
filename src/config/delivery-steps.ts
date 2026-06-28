/** 納品フロー（オンボーディング）のチェックリスト定義。運営コンソールで進捗管理する。 */
export interface DeliveryStep {
  key: string;
  label: string;
  hint?: string;
  /** 任意ステップ（クライアントにより不要な場合あり）。納品完了判定には含めない。 */
  optional?: boolean;
}

export const DELIVERY_STEPS: DeliveryStep[] = [
  { key: "provisioned", label: "発行（.env 生成）", hint: "provision コマンドでインスタンス設定を生成" },
  { key: "deployed", label: "デプロイ（固定HTTPSで稼働）", hint: "ホスティングに配置し公開URLを台帳に登録" },
  { key: "line_connected", label: "LINE 接続", hint: "チャネル登録＋Webhook URL を LINE Developers に設定" },
  { key: "payment_setup", label: "決済設定（Stripe）", hint: "本番キー・Webhook 設定", optional: true },
  { key: "ai_setup", label: "AI 設定", hint: "Anthropic キー・キャラ/FAQ", optional: true },
  { key: "scenario_setup", label: "初期シナリオ構築", hint: "ステップ配信などの初期設定", optional: true },
  { key: "handover", label: "引き渡し", hint: "初期ログイン情報・クライアント用マニュアルの共有" },
];

export const REQUIRED_DELIVERY_KEYS = DELIVERY_STEPS.filter((s) => !s.optional).map((s) => s.key);

export interface DeliveryProgress {
  doneRequired: number;
  totalRequired: number;
  doneCount: number;
  total: number;
  /** 必須ステップがすべて完了＝納品済み。 */
  delivered: boolean;
}

/** 完了ステップ配列から進捗・納品判定を算出。 */
export function deliveryProgress(done: string[] = []): DeliveryProgress {
  const doneSet = new Set(done);
  const doneRequired = REQUIRED_DELIVERY_KEYS.filter((k) => doneSet.has(k)).length;
  return {
    doneRequired,
    totalRequired: REQUIRED_DELIVERY_KEYS.length,
    doneCount: DELIVERY_STEPS.filter((s) => doneSet.has(s.key)).length,
    total: DELIVERY_STEPS.length,
    delivered: doneRequired === REQUIRED_DELIVERY_KEYS.length,
  };
}
