# コントロールプレーン（運営側 一括管理）

複数クライアントを **各自独立インスタンス（モデルB：別サーバー＋別DB）** のまま運用し、運営（開発者）が1つの管理コンソールから **台帳・稼働監視・新規発行・遠隔操作・横断集計** を行う仕組み。

```
LCall運営（コントロールプレーン）  ← LCALL_CONTROL_PLANE=true で起動・専用DB
 ├─ Aクライアント（別サーバー・別DB） ← 既存LCallアプリ1インスタンス＋LCALL_OPERATOR_KEY
 ├─ Bクライアント（別サーバー・別DB）
 └─ …
```

同一リポジトリを **2モード**で使う：
- 通常デプロイ＝クライアントアプリ（`(operator)` は 404）。
- `LCALL_CONTROL_PLANE=true` のデプロイ＝運営コンソール（`/operator`。クライアント画面 `/` は `/operator` へリダイレクト）。

## 連携の仕組み

各クライアントインスタンスは運営API `/api/operator/*` を公開し、`LCALL_OPERATOR_KEY`（インスタンス毎にユニーク）で保護する。コンソールは台帳に保存したキーを `x-lcall-operator-key` ヘッダに付けて呼ぶ。

- `GET /api/operator/health` … 稼働確認（version 等）。
- `GET /api/operator/metrics` … 友だち/有効/配信/クリック/AI応対/プラン/請求状態/MRR。
- `POST /api/operator/control` … `{ action: "suspend" | "resume" }` で配信を一時停止/再開（`SystemSetting operations_suspended`。`deliverBroadcast`/`processScenarios` が参照）。

> 遠隔操作は**運用フラグ（配信停止/再開）に限定**。env更新・再デプロイ等のインフラ操作はホスティングのAPIが必要で対象外（将来拡張）。

## 環境変数

| 変数 | どのデプロイ | 役割 |
|---|---|---|
| `LCALL_CONTROL_PLANE` | 運営コンソール | `true` でコンソール有効化 |
| `DATABASE_URL` | 運営コンソール | 台帳DB（Supabase `lcall` 推奨）|
| `LCALL_OPERATOR_KEY` | 各クライアント | コンソール↔インスタンスの共有シークレット（ユニーク）|

運営コンソールのログインは通常どおり（`LCALL_ADMIN_EMAIL`/`LCALL_ADMIN_PASSWORD_HASH` または DB の owner ユーザー）。owner のみアクセス可。

## 新規クライアントの発行フロー（MVP）

1. コンソール `/operator/clients/new` で発行 → 台帳に `ClientAccount`＋`ClientInstance`（`operatorKey` 自動生成）。
2. 詳細画面に表示される provision コマンドを実行（運営キーが一致）:
   ```
   npm run provision -- <slug> --base-url <baseUrl> --email <email> --operator-key <operatorKey>
   ```
   → `clients/<slug>/.env` を生成（初期PWは一度だけ表示）。
3. 本番DBを使うなら `.env` に `DATABASE_URL` を設定（必要に応じ `ANTHROPIC_API_KEY`/`STRIPE_*`/`R2_*`）。
4. `npm run build` → `node --env-file=clients/<slug>/.env ./node_modules/next/dist/bin/next start` で起動し、固定HTTPSのURLを台帳の「公開URL」に設定。
5. 詳細画面の「今すぐ確認」で health/metrics を取得 → 横断ダッシュボードに反映。

> 自動デプロイ（Supabase/Render等のAPIでプロビジョニング）は今回スコープ外。発行は台帳登録＋手順生成まで。

## 画面（`/operator`）

- **ダッシュボード** … 横断集計（クライアント数・稼働up/down・総友だち/配信/クリック・MRR合計・支払延滞数）。
- **クライアント** … 台帳一覧（プラン/契約/稼働/友だち/MRR/最終確認）＋新規発行。
- **クライアント詳細** … インスタンス情報・最新メトリクス・「今すぐ確認」・遠隔操作（停止/再開）・起動手順・台帳編集。
- **アフィリエイト** … スキーマのみ（次回実装）。

## アフィリエイト（設計のみ・今回UIなし）

外部パートナーが新規クライアントを紹介し成約で報酬。台帳DBにスキーマを用意済み：
- `Affiliate`（紹介者・コード・状態・支払先メモ）
- `AffiliateReferral`（clicked→signed_up→converted・成約クライアント紐付け）
- `AffiliateCommission`（signup 一括 / recurring 月次・pending/approved/paid）

`ClientAccount.affiliateId` で獲得元を紐付け可能。紹介リンク発行・成果計上・報酬集計/支払は次フェーズ。

## 留意

- `operatorKey` は運営DBに平文保存（運営専用DB・HTTPS前提）。将来は暗号化/ローテーション可。
- 監視は当面オンデマンド（「今すぐ確認」）。自動巡回が必要なら `(operator)` 用の cron 実行口を追加可能。
- マルチテナント（モデルA・1DB相乗り）は不採用。分離はモデルB維持。
