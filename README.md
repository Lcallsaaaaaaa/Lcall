# LCall 管理画面

低コスト納品型 LINE マーケティングシステム（LSTEP / UTAGE が難しいと感じる層向け）の管理画面。
実装済み: **F0〜F5 すべて** — フェーズ0（基盤 + ダッシュボード）/ F1（LINEアカウント + 分散登録URL）/ F2（顧客 + タグ）/ F3（配信 + カルーセル + Workersクリック計測）/ F4（フォーム + アンケート + 分析 + CSV）/ F5（簡易LP + 契約・請求〔モックStripe〕 + Looker連携手順）。
さらに以下を追加（開発指示書 v1 外の要望対応）:
- **チャット対応（1:1トーク受信箱 `/inbox`）** — 受信に個別返信、プロフィール確認、表示名変更、タグ付与、定型文送信、カルーセル送信。**定型文**は `/message-templates` で管理。
- **LINE実受信/返信** — Webhook `/api/line/webhook/[lineAccountId]`（署名検証→受信保存→挨拶/シナリオ起動）、返信は Messaging API push（実トークン時）。手順は [docs/line-setup.md](docs/line-setup.md)。
- **シナリオ配信 `/scenarios`** — 追加時挨拶＋経過時間ステップ＋対象タグ出し分け＋**ステップ単位の条件分岐**（タグを持つ/持たない人だけ配信。直前ステップで付与したタグも反映）。実行は `/api/scenarios/run`（cron想定）。
- **メディア（画像）`/media`** — 画像を**ファイルアップロード**（`/api/media/upload`）。**Cloudflare R2（S3互換）対応**（`R2_*` env 設定時はR2へ、未設定はローカル `public/uploads`）。URL登録も可。シナリオ等で「保管から選択」。
- **シナリオのステップ配信時刻** — 各ステップに「○日後の HH:MM」を指定可能。**ステップにカルーセル配信も指定可能**（テキスト/カルーセルを選択）。
- **分析にLINEアカウント別 総配信数** — `/analytics` に送信元アカウント別の配信数（全体配信は友だち数で按分）。
- **カルーセルクリックでタグ自動付与** — 各カルーセルカードの「クリック時に付与するタグ」で、計測URLクリック時に自動付与（既存）。
- **カルーセル実送信** — 配信のカルーセルを実LINE（template/carousel push）で送信、チャット・シナリオからも送信。
- **広告コード（流入元）`/ad-codes`** — 広告ごとにコード発行→登録URL `?ad=CODE`→登録した友だちに流入元を記録→チャットのプロフィールで確認。**計測URL（クリック）にも広告コードを付与でき、クリックした友だちに流入元を記録**。

## クイックスタート

```bash
npm install
npm run dev
# http://localhost:3000 → /login → 「開発用ログインで入る」でダッシュボードへ
```

`.env.local` は同梱済み（`LCALL_ALLOW_DEV_LOGIN=true` でGoogle未設定でも開発ログイン可）。

## アーキテクチャ（納品モデル）

- **フロント/API**: Next.js 16（App Router）+ React 19 + TypeScript
- **UI**: Tailwind CSS v4 / Stripe ダッシュボード調
- **データ**: Repository パターンで抽象化（`src/lib/data`）
  - `memory`（既定）= インメモリのダミーデータ（ローカル開発・デモ）
  - `sheets` = Google Sheets（後続フェーズで実装。本番データはクライアントのGoogleアカウント上のSheetsに保存）
  - 将来は専用DBアダプタへ差し替え可能（画面・APIは `getDataProvider()` 越しにのみ触る）
- **認証**: 軽量セッション（HMAC署名Cookie / Node ランタイム）。開発用ログイン＋Google OAuth に対応
- **計測/リダイレクト**: Cloudflare Workers に分離（`worker/`。KVにリンク表キャッシュ＋`ctx.waitUntil`でNext取込APIへ非同期送信。`openExternalBrowser=1` 付与）。ローカルは `cd worker && npm run dev`（:8787）
- **分析**: Sheets を Looker Studio が直結参照（後続フェーズ）

> 「Googleアカウント納品型」= クライアントのGoogleアカウントに **データ(Sheets)と分析(Looker Studio)** を置き、
> アプリ本体は1コードベースをクライアントごとの設定で動かすマネージド型。そのまま将来のSaaS化の土台になる。

## ディレクトリ構成

```
src/
  app/
    login/page.tsx              ログイン（Google + 開発用）
    (dashboard)/                認証必須レイアウト（Sidebar + Topbar）
      layout.tsx  page.tsx      ダッシュボード本体
    api/auth/                   login / logout / google / google/callback
  components/
    layout/                     Sidebar, Topbar
    ui/                         Button, Card, KpiCard, DataTable, StatusBadge, GradientLogo
    charts/                     RegistrationTrend, LineBreakdown（自作SVG/CSS）
  features/dashboard/metrics.ts ダッシュボード集計
  lib/
    auth.ts                     セッション/認証
    data/                       types, repository, provider, memory-adapter, seed, sheets-adapter
    cn.ts
  config/                       nav.ts（サイドバー）, plans.ts（プラン/料金 §10,§5）
```

## デザイン方針

Stripe 調（白背景・薄いグレー罫線・KPIカード・テーブル中心）。
ブランドの Instagram風グラデーション `linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)` は
**アクセント限定**で使用：CTAボタン / ロゴ / 選択中ナビ / 重要KPIのアクセントのみ。

## 環境変数

`.env.example` 参照。主なもの:

| 変数 | 説明 |
| --- | --- |
| `LCALL_DATA_ADAPTER` | `memory`（既定） / `sheets` |
| `LCALL_SESSION_SECRET` | セッションCookie署名キー（本番は長いランダム値） |
| `LCALL_ALLOW_DEV_LOGIN` | 開発用ログインの許可（本番は `false` 推奨） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth（設定すると有効化） |

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（Turbopack） |
| `npm run build` | 本番ビルド |
| `npm start` | 本番起動 |
| `npm run lint` | ESLint |

## 開発ロードマップ（フェーズ0の次）

- **F1**: LINEアカウント管理（最大15→将来50）/ 分散登録URL（ランダム・均等・重み付き、停止/上限除外、振分ログ）
- ~~**F2**: 顧客管理 / タグ管理（自動付与）~~ ✅ 実装済み
- ~~**F3**: 配信（テキスト/カルーセル/URL、予約・履歴・テンプレ）/ Cloudflare Workers 計測 / クリック時タグ付け~~ ✅ 実装済み（計測Workerは `worker/`）
- ~~**F4**: 申込フォーム / アンケート / 簡易分析 / CSV出力~~ ✅ 実装済み（公開フォーム `/f/[id]`・公開アンケート `/s/[id]`・CSV `/api/export/[dataset]`）
- ~~**F5**: Stripe（初期5万・月額1.5万・自動課金、失敗時14日停止/30日削除）/ 簡易LP / LTV・残存分析 / Looker Studio 連携~~ ✅ 実装済み（決済はモック。Looker は [docs/looker-studio.md](docs/looker-studio.md) の連携手順）

## 残課題（本番化）

ロードマップは完了。本番投入に向けた残作業:
- **Google Sheets アダプタ本実装**（`src/lib/data/sheets-adapter.ts`）→ `LCALL_DATA_ADAPTER=sheets` で本番データ永続化。Looker Studio はこの Sheets を直結。
- **実 Stripe 接続**（現状モック）: Checkout/Billing + Webhook で課金状態同期。
- **実 LINE Messaging API 送信**（現状シミュレート）と **Google OAuth 本番接続**。
- Cloudflare Worker の本番デプロイ（`worker/README.md`）。
- 計測URL `?u=` / 公開フォームの友だち識別の署名（なりすまし対策）。

## Next.js 16 メモ

- Turbopack がデフォルト（`next dev` / `next build`）
- `cookies()` / `headers()` / `params` / `searchParams` は **async（await 必須）**
- `middleware` → `proxy` に改名、`next lint` は廃止（ESLint を直接実行）
