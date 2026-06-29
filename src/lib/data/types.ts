/**
 * LCall ドメイン型（開発指示書 §6 のテーブル相当）。
 *
 * ここはストレージ非依存の「業務モデル」。MemoryAdapter / SheetsAdapter /
 * 将来の DbAdapter はすべてこの型を読み書きする。
 * 列追加時はまずここを直し、各アダプタを追従させる。
 */

export type ID = string;
export type ISODate = string; // 例: "2026-06-26T09:00:00.000Z"

/** LINEアカウントの状態（UIバッジに対応） */
export type LineAccountStatus = "active" | "paused" | "warning" | "suspended";

/** 分散登録の振り分け方式 */
export type DistributionStrategy = "random" | "even" | "weighted";

/** 配信タイプ */
export type BroadcastType = "text" | "carousel" | "url";

/** 配信ステータス */
export type BroadcastStatus = "draft" | "scheduled" | "sent" | "failed";

/** プラン（§10） */
export type PlanCode = "lite" | "standard" | "pro";

/** 役割（owner=オーナー/管理者、admin=運用担当、staff=チャット対応） */
export type Role = "owner" | "admin" | "staff";

/** 管理ユーザー / スタッフ（§6 users, staff_users） */
export interface User {
  id: ID;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  /** scrypt ハッシュ（`scrypt:salt:hash`）。データ登録ユーザーのログイン用 */
  passwordHash?: string;
  createdAt: ISODate;
}

/** LINE公式アカウント（§6 line_accounts / §5 LINEアカウント管理） */
export interface LineAccount {
  id: ID;
  name: string;
  status: LineAccountStatus;
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  addFriendUrl: string;
  /** 登録上限数 */
  capacity: number;
  /** 現在の登録者数（集計キャッシュ） */
  registeredCount: number;
  /** 振り分け重み（weighted 用 / even・random では参考値） */
  weight: number;
  /** 予備LINEのURL（§8 予備LINE・緊急導線） */
  backupUrl?: string;
  /** 緊急時の移行案内メッセージ */
  migrationMessage?: string;
  /** AI自動応答の有効化（このアカウント＝クライアント単位） */
  aiEnabled?: boolean;
  /** 既定のAIキャラクター（アカウント単位）。タグ/友だちで上書き可 */
  aiCharacterId?: ID;
  /** アカウント別の Anthropic APIキー（未指定は環境変数 ANTHROPIC_API_KEY を使用） */
  aiApiKey?: string;
  createdAt: ISODate;
}

/** AIキャラクター（応答のペルソナ＝口調・知識・モデル。再利用・出し分け可） */
export interface AiCharacter {
  id: ID;
  /** キャラ名（AI返信の差出人名にも使用） */
  name: string;
  /** 性格・口調・役割・禁止事項・引き継ぎ条件 */
  persona?: string;
  /** 業務知識・FAQ */
  faq?: string;
  /** 使用するモデルID（未指定は既定の Haiku） */
  model?: string;
  /** アバター画像URL（任意） */
  avatarUrl?: string;
  createdAt: ISODate;
}

/** 計測リダイレクトリンク（§6 redirect_links / §7 クリック計測） */
export interface RedirectLink {
  id: ID;
  trackingId: string;
  targetUrl: string;
  openExternalBrowser: boolean;
  /** クリック時に自動付与するタグ */
  autoTagId?: ID;
  /** 流入元（広告コード）。クリックした友だちに sourceCode として付与 */
  adCode?: string;
  broadcastId?: ID;
  createdAt: ISODate;
}

/** 共通登録URLの振り分けログ（§6 distribution_logs / §5 分散登録URL管理） */
export interface DistributionLog {
  id: ID;
  assignedLineAccountId: ID;
  strategy: DistributionStrategy;
  /** 流入元（広告コード）。?ad=CODE 経由のとき記録 */
  adCode?: string;
  /** 広告クリックID等（Google=gclid / Meta=fbclid・_fbpクッキー）。着地時に記録し、
   *  友だち追加(follow)時にコンバージョンAPIへ引き継ぐ。 */
  gclid?: string;
  fbclid?: string;
  fbp?: string;
  /** マッチ品質向上用（クリック時のIP/UA）。CAPI送信に利用 */
  clientIp?: string;
  userAgent?: string;
  /** この登録ログに紐づいた友だち（コンバージョン重複送信の防止） */
  friendId?: ID;
  convertedAt?: ISODate;
  createdAt: ISODate;
}

/** 友だち＝顧客（§6 friends / §5 顧客管理） */
export interface Friend {
  id: ID;
  lineUserId: string;
  displayName: string;
  /** LINEプロフィール画像URL */
  pictureUrl?: string;
  /** 登録されたLINEアカウント */
  lineAccountId: ID;
  registeredAt: ISODate;
  lastClickAt?: ISODate;
  /** ブロック（unfollow）された日時 */
  blockedAt?: ISODate;
  ltv: number;
  status: "active" | "blocked" | "unsubscribed";
  /** 流入元（広告コード） */
  sourceCode?: string;
  /** 広告クリックID（登録時に直近の登録ログから推定付与）。追加後のクリック計測も媒体へ送れる */
  gclid?: string;
  fbclid?: string;
  /** AI自動応答をこの友だちで一時停止（有人対応に切替） */
  aiPaused?: boolean;
  /** この友だち専用のAIキャラ上書き（最優先） */
  aiCharacterId?: ID;
}

/** タグ（§6 tags / §5 タグ管理） */
export interface Tag {
  id: ID;
  name: string;
  color?: string;
  /** このタグを持つ友だちに適用するAIキャラ（セグメント出し分け＝B） */
  aiCharacterId?: ID;
  createdAt: ISODate;
}

/** 友だち×タグの中間（§6 friend_tags） */
export interface FriendTag {
  id: ID;
  friendId: ID;
  tagId: ID;
  /** クリック等による自動付与か */
  auto: boolean;
  createdAt: ISODate;
}

/** 配信（§6 broadcasts / §5 配信管理） */
export interface Broadcast {
  id: ID;
  title: string;
  type: BroadcastType;
  status: BroadcastStatus;
  /** メッセージ本文（text / url 配信） */
  text?: string;
  /** タグ条件付き配信の対象タグ */
  targetTagIds: ID[];
  /** 配信元のLINEアカウント（未指定なら全体） */
  lineAccountId?: ID;
  scheduledAt?: ISODate;
  sentAt?: ISODate;
  /** 送信総数 */
  sentCount: number;
  createdAt: ISODate;
}

/** 配信テンプレート（§5 配信テンプレート保存） */
export interface BroadcastTemplate {
  id: ID;
  name: string;
  type: BroadcastType;
  text?: string;
  targetTagIds: ID[];
  /** カルーセルのカード構成スナップショット（JSON文字列） */
  cardsJson?: string;
  createdAt: ISODate;
}

/** 配信ターゲット（§6 broadcast_targets） */
export interface BroadcastTarget {
  id: ID;
  broadcastId: ID;
  friendId: ID;
  delivered: boolean;
}

/** カルーセルカード（§6 carousel_cards / §5 カルーセル作成） */
export interface CarouselCard {
  id: ID;
  broadcastId: ID;
  order: number;
  title: string;
  description: string;
  imageUrl: string;
  buttonLabel: string;
  /** 表示は計測URLを経由（trackingId に紐づく） */
  redirectLinkId: ID;
  openExternalBrowser: boolean;
}

/** クリックログ（§6 click_logs / §7 クリック計測） */
export interface ClickLog {
  id: ID;
  redirectLinkId: ID;
  friendId?: ID;
  broadcastId?: ID;
  /** 流入元（広告コード）。リンクに設定されていれば記録 */
  adCode?: string;
  clickedAt: ISODate;
}

/** 申込フォーム（§6 forms / §5 申込フォーム管理） */
export interface Form {
  id: ID;
  title: string;
  description?: string;
  /** 回答時に付与するタグ（§5 回答時タグ付け） */
  autoTagId?: ID;
  createdAt: ISODate;
}

export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "select"
  | "checkbox"
  | "date"
  | "textarea";

export interface FormField {
  id: ID;
  formId: ID;
  label: string;
  type: FormFieldType;
  required: boolean;
  order: number;
  options?: string[];
}

export interface FormResponse {
  id: ID;
  formId: ID;
  friendId?: ID;
  values: Record<string, string>;
  createdAt: ISODate;
}

/** アンケート（§6 surveys / §5 アンケート管理） */
export interface Survey {
  id: ID;
  title: string;
  /** 回答時に付与するタグ（§5 回答内容によるタグ付け：MVPは回答時に一律付与） */
  autoTagId?: ID;
  createdAt: ISODate;
}

export type SurveyQuestionType = "rating5" | "select" | "textarea";

export interface SurveyQuestion {
  id: ID;
  surveyId: ID;
  label: string;
  type: SurveyQuestionType;
  order: number;
  options?: string[];
}

export interface SurveyResponse {
  id: ID;
  surveyId: ID;
  friendId?: ID;
  values: Record<string, string | number>;
  createdAt: ISODate;
}

/** 簡易LP（§6 landing_pages / §5 LP管理） */
export interface LandingPage {
  id: ID;
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  formId?: ID;
  paymentUrl?: string;
  thanksMessage?: string;
  createdAt: ISODate;
}

/** LTV記録（§6 ltv_records / §5 分析） */
export interface LtvRecord {
  id: ID;
  friendId: ID;
  amount: number;
  occurredAt: ISODate;
}

/** 課金顧客（§6 billing_customers / §5 契約・請求管理） */
export interface BillingCustomer {
  id: ID;
  stripeCustomerId: string;
  plan: PlanCode;
  status: "active" | "past_due" | "paused" | "canceled";
  nextBillingAt?: ISODate;
  /** 支払い失敗日時。+14日で配信停止、+30日でデータ削除対象（§5） */
  paymentFailedAt?: ISODate;
  /** 実Stripe連携時のサブスクリプションID（sub_...） */
  stripeSubscriptionId?: string;
  createdAt: ISODate;
}

/** 請求の種別。AI従量も実Stripe請求の履歴に出る */
export type InvoiceKind = "setup" | "monthly" | "usage";

/** 請求（モックStripe の支払い履歴） */
export interface Invoice {
  id: ID;
  billingCustomerId: ID;
  kind: InvoiceKind;
  amount: number;
  status: "paid" | "failed";
  issuedAt: ISODate;
}

/** システム設定（§6 system_settings） */
export interface SystemSetting {
  id: ID;
  key: string;
  value: string;
}

/** シナリオ（ステップ配信） */
export interface Scenario {
  id: ID;
  name: string;
  status: "active" | "paused";
  /** 対象タグ（タグ分け）。未指定なら全友だちが対象 */
  targetTagId?: ID;
  createdAt: ISODate;
}

/** ステップの配信条件（タグ分岐） */
export type StepConditionMode = "always" | "hasTag" | "notHasTag";

/** シナリオのステップ（登録/開始からの経過時間で配信） */
export interface ScenarioStep {
  id: ID;
  scenarioId: ID;
  order: number;
  /** 登録からの経過時間（分）。0 = 追加時挨拶 */
  delayMinutes: number;
  text: string;
  imageUrl?: string;
  /** 配信時に付与するタグ */
  autoTagId?: ID;
  /** 配信条件（タグ分岐）。未指定/always は全員 */
  conditionMode?: StepConditionMode;
  conditionTagId?: ID;
  /** 配信時刻（任意）。指定時は「登録+遅延」の当日 HH:MM に配信 */
  sendAtHour?: number;
  sendAtMinute?: number;
  /** 指定時はカルーセルステップ（その配信のカードを送る）。未指定はテキスト */
  carouselBroadcastId?: ID;
}

/** シナリオ配信実績（重複送信防止＋履歴）。条件不一致のスキップも記録する */
export interface ScenarioDelivery {
  id: ID;
  scenarioId: ID;
  stepId: ID;
  friendId: ID;
  /** true=送信、false=条件不一致でスキップ */
  sent: boolean;
  sentAt: ISODate;
}

/**
 * アプリ内蔵の画像保管（R2 未設定時のフォールバック）。
 * バイト列を base64 で保持し、`/api/img/{id}` で配信する（Render等でローカルファイルが
 * 配信/永続化できない問題を回避）。
 */
export interface StoredImage {
  id: ID;
  contentType: string;
  /** 画像バイトの base64 */
  data: string;
  /** "chat"=受信画像（保存期間で自動削除対象）/ "asset"=メディア・カルーセル（保持）。未指定はasset扱い */
  kind?: "chat" | "asset";
  createdAt: ISODate;
}

/** メディア（画像）ライブラリ。保管した画像から選んで設定する */
export interface MediaAsset {
  id: ID;
  name: string;
  url: string;
  createdAt: ISODate;
}

/** チャットの定型文（テンプレメッセージ） */
export interface MessageTemplate {
  id: ID;
  title: string;
  text: string;
  createdAt: ISODate;
}

/** 広告コード（流入元）。登録URLに付与して流入元を計測 */
export interface AdCode {
  id: ID;
  code: string;
  label: string;
  createdAt: ISODate;
}

/** 予約ページ（予約表）。作成時に simple / menu を選ぶ。 */
export type ReservationType = "simple" | "menu";
export interface ReservationPage {
  id: ID;
  title: string;
  /** simple=日時枠のみ / menu=メニュー（所要時間・料金）を選んでから日時 */
  type: ReservationType;
  /** 対象の公式アカウント（未指定=共通＝全アカウント）。友だち追加リンク/自動紐づけに使用 */
  lineAccountId?: ID;
  /** 事前支払い。"none"=なし（既定）/ "prepay"=全額前払い（Stripe・要キー設定。メニュー/オプションに料金が必要） */
  paymentMode?: "none" | "prepay";
  description?: string;
  /** 開始時刻の刻み（分）。例 30 */
  slotMinutes: number;
  /** simple のときの1枠の所要時間（分）。menu はメニュー側 duration を使う */
  durationMinutes: number;
  /** 1つの開始時刻あたりの定員 */
  capacity: number;
  /** 営業時間（24h・時）。open=10, close=19 など */
  openHour: number;
  closeHour: number;
  /** 休業曜日（0=日 … 6=土） */
  closedWeekdays: number[];
  /** 何日先まで受け付けるか */
  daysAhead: number;
  /** 変更・キャンセルの受付期限（開始の何時間前まで可。未設定/0=開始直前まで可） */
  changeDeadlineHours?: number;
  /** 予約時に付与するタグ */
  autoTagId?: ID;
  /** 予約確定LINEメッセージ（{{name}} 使用可。空ならデフォルト文） */
  confirmText?: string;
  /** 予約完了画面の「友だち追加」案内文（空ならデフォルト文） */
  joinText?: string;
  /** 予約発生/キャンセル時の通知先メール（任意・メール送信設定が必要） */
  notifyEmail?: string;
  /** 予約発生/キャンセル時にLINE通知する対象タグ（このタグを持つ友だち＝オーナー/スタッフ等へ通知） */
  notifyTagId?: ID;
  createdAt: ISODate;
}

/** 予約メニュー／オプション（type=menu のとき）。kind=option は基本メニューに追加できる選択肢。 */
export interface ReservationMenu {
  id: ID;
  reservationPageId: ID;
  name: string;
  durationMinutes: number;
  price?: number;
  order: number;
  /** 既定は "menu"（基本メニュー）。"option" は追加オプション */
  kind?: "menu" | "option";
}

/** 予約（1件の予約）。 */
export interface Reservation {
  id: ID;
  reservationPageId: ID;
  friendId?: ID;
  menuId?: ID;
  /** 紐づく公式アカウント（予約時に決定。友だち追加(follow)時の自動紐づけ・通知に使用） */
  lineAccountId?: ID;
  /** 予約開始/終了（ISO） */
  startAt: ISODate;
  endAt: ISODate;
  /** pending=事前支払い待ち（枠は仮押さえ・成功で confirmed）。 */
  status: "pending" | "confirmed" | "cancelled" | "done" | "noshow";
  /** 事前支払いの状態 */
  paymentStatus?: "unpaid" | "paid" | "refunded";
  /** 請求額（円） */
  amount?: number;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  /** 選択した追加オプション（ReservationMenu.kind="option" のid） */
  optionIds?: ID[];
  /** 予約者の入力（LINE名と別に氏名・電話を取りたい場合） */
  name?: string;
  phone?: string;
  note?: string;
  /** 自己キャンセル用トークン */
  cancelToken?: string;
  /** リマインド送信済み時刻（重複防止） */
  remindedAt?: ISODate;
  createdAt: ISODate;
}

/** 広告コンバージョン送信ログ（Meta Conversions API / Google）。送信可否・結果の可視化と重複防止用。 */
export interface ConversionLog {
  id: ID;
  friendId?: ID;
  platform: "meta" | "google";
  /** 送信イベント名（例: friend_add / Lead） */
  event: string;
  adCode?: string;
  status: "sent" | "failed" | "skipped";
  /** 結果やスキップ理由の補足（HTTPステータス・エラー要旨など） */
  detail?: string;
  createdAt: ISODate;
}

/** 1:1 チャット対応メッセージ（個別トーク） */
export interface ChatMessage {
  id: ID;
  friendId: ID;
  /** in=友だち→自社、out=自社→友だち */
  direction: "in" | "out";
  text: string;
  /** 画像メッセージのときの公開URL（受信画像など） */
  imageUrl?: string;
  /** out のとき対応スタッフ名 */
  staffName?: string;
  /** AI自動応答で生成・送信したメッセージ（従量課金の対象） */
  ai?: boolean;
  /** AI従量を実Stripeへ計上済み（二重計上防止） */
  aiBilled?: boolean;
  /** 受信(in)の既読管理。out は常に true */
  read: boolean;
  createdAt: ISODate;
}

/** リッチメニューのサイズ（LINE: large=2500×1686 / compact=2500×843） */
export type RichMenuSize = "large" | "compact";

/** リッチメニューのタップ領域に割り当てるアクション種別 */
export type RichMenuActionType = "uri" | "message" | "none";

/** リッチメニューの1タップ領域（テンプレートのセルに1対1で対応） */
export interface RichMenuArea {
  /** none=タップ無効（その領域はLINEに送らない） */
  action: RichMenuActionType;
  /** ボタンの表示/管理用ラベル（uri アクションの label にも使用） */
  label?: string;
  /** action=uri のリンク先（https / tel: / line:// 等） */
  uri?: string;
  /** action=message で送信するテキスト */
  text?: string;
}

/** リッチメニュー（トーク画面下部の固定メニュー）。テンプレート方式で領域を構成 */
export interface RichMenu {
  id: ID;
  /** 管理用の名称 */
  name: string;
  /** 紐づくLINEアカウント */
  lineAccountId: ID;
  /** サイズ（テンプレートに連動） */
  size: RichMenuSize;
  /** レイアウトテンプレートID（config/rich-menu-templates） */
  template: string;
  /** メニューバーに表示するテキスト（≤14文字） */
  chatBarText: string;
  /** メニュー画像の公開URL（プレビュー用。LINEへはバイトをアップロード） */
  imageUrl?: string;
  /** 各セルのアクション（テンプレートのセル数と一致） */
  areas: RichMenuArea[];
  /** 既定メニュー（全友だちに表示）か */
  isDefault: boolean;
  /** タグ別出し分け：指定時はこのタグを持つ友だちにリンク */
  targetTagId?: ID;
  /** 実LINEに作成済みのリッチメニューID（反映後にセット） */
  lineRichMenuId?: string;
  /** 実LINEへ反映した日時 */
  appliedAt?: ISODate;
  createdAt: ISODate;
}

// ===== コントロールプレーン（運営側・複数クライアント一括管理） =====
// これらは運営コンソール（LCALL_CONTROL_PLANE=true）のDBでのみ使用する。
// クライアント各インスタンスのDBでは空のまま（無害）。

/** 運営が管理する1クライアント（契約単位）。実体は独立インスタンス（モデルB）。 */
export interface ClientAccount {
  id: ID;
  name: string;
  /** 識別用スラッグ（インスタンスのディレクトリ名等に対応） */
  slug: string;
  contactEmail: string;
  plan: PlanCode;
  status: "trial" | "active" | "suspended" | "canceled";
  /**
   * 申込時に採番された Stripe 顧客ID（cus_…）。納品前の支払い情報と
   * 各インスタンスの BillingCustomer を結ぶ鍵。カード番号自体は保持しない（Stripe保管）。
   */
  stripeCustomerId?: string;
  /** 獲得元アフィリエイト（設計のみ・任意） */
  affiliateId?: ID;
  /** 納品チェックリストの完了ステップキー（config/delivery-steps の key） */
  deliverySteps?: string[];
  notes?: string;
  createdAt: ISODate;
}

/** クライアントの稼働インスタンス（デプロイ先）。運営APIで監視・遠隔操作する。 */
export interface ClientInstance {
  id: ID;
  clientAccountId: ID;
  /** 公開URL（例 https://acme.example.com）。末尾スラッシュ無し */
  baseUrl: string;
  /** このインスタンスの運営API共有シークレット（x-lcall-operator-key） */
  operatorKey: string;
  /** ホスティングのメモ（Render/Railway 等・任意） */
  hostingNote?: string;
  status: "up" | "down" | "unknown";
  /** 最終ヘルス確認で取得したアプリ版（任意） */
  appVersion?: string;
  lastSeenAt?: ISODate;
  createdAt: ISODate;
}

/** インスタンス指標のスナップショット（運営APIのポーリング結果）。横断集計に使用。 */
export interface InstanceMetric {
  id: ID;
  instanceId: ID;
  capturedAt: ISODate;
  totalFriends: number;
  activeFriends: number;
  deliveries: number;
  clicks: number;
  aiReplies: number;
  plan?: PlanCode;
  billingStatus?: string;
  /** 月次経常収益（円・税込） */
  mrr?: number;
}

// ----- アフィリエイト（外部パートナー→クライアント獲得）。今回はスキーマのみ -----

/** 紹介者（アフィリエイト・パートナー）。 */
export interface Affiliate {
  id: ID;
  name: string;
  email: string;
  /** 紹介リンクに使うコード（一意） */
  code: string;
  status: "active" | "suspended";
  /** 支払先メモ（口座等・任意） */
  payoutNote?: string;
  createdAt: ISODate;
}

/** 紹介の発生〜成約の記録。 */
export interface AffiliateReferral {
  id: ID;
  affiliateId: ID;
  code: string;
  landingAt: ISODate;
  /** 成約したクライアント（紐付け後） */
  clientAccountId?: ID;
  convertedAt?: ISODate;
  status: "clicked" | "signed_up" | "converted";
}

/** 報酬。成約一括（signup）or 月次レベニューシェア（recurring）。 */
export interface AffiliateCommission {
  id: ID;
  affiliateId: ID;
  clientAccountId: ID;
  kind: "signup" | "recurring";
  /** 金額（円） */
  amount: number;
  /** recurring の対象月（YYYY-MM・任意） */
  periodMonth?: string;
  status: "pending" | "approved" | "paid";
  createdAt: ISODate;
}

/** エンティティ名 → 型 のマップ（DataProvider のキーに使用） */
export interface EntityMap {
  users: User;
  lineAccounts: LineAccount;
  richMenus: RichMenu;
  redirectLinks: RedirectLink;
  distributionLogs: DistributionLog;
  friends: Friend;
  tags: Tag;
  friendTags: FriendTag;
  broadcasts: Broadcast;
  broadcastTemplates: BroadcastTemplate;
  broadcastTargets: BroadcastTarget;
  carouselCards: CarouselCard;
  clickLogs: ClickLog;
  forms: Form;
  formFields: FormField;
  formResponses: FormResponse;
  surveys: Survey;
  surveyQuestions: SurveyQuestion;
  surveyResponses: SurveyResponse;
  landingPages: LandingPage;
  ltvRecords: LtvRecord;
  billingCustomers: BillingCustomer;
  invoices: Invoice;
  chatMessages: ChatMessage;
  messageTemplates: MessageTemplate;
  aiCharacters: AiCharacter;
  adCodes: AdCode;
  scenarios: Scenario;
  scenarioSteps: ScenarioStep;
  scenarioDeliveries: ScenarioDelivery;
  mediaAssets: MediaAsset;
  storedImages: StoredImage;
  conversionLogs: ConversionLog;
  reservationPages: ReservationPage;
  reservationMenus: ReservationMenu;
  reservations: Reservation;
  systemSettings: SystemSetting;
  // コントロールプレーン（運営DBのみ使用）
  clientAccounts: ClientAccount;
  clientInstances: ClientInstance;
  instanceMetrics: InstanceMetric;
  affiliates: Affiliate;
  affiliateReferrals: AffiliateReferral;
  affiliateCommissions: AffiliateCommission;
}

export type EntityName = keyof EntityMap;
