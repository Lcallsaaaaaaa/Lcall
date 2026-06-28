# 納品ランブック（定型手順）

新規クライアントを「発行 → 稼働 → 引き渡し」まで進めるための定型手順。運営コンソール（コントロールプレーン）の**納品チェックリスト**と対応している。

## 確定した構成（モデルB＝1クライアント1インスタンス）

| 役割 | 採用 | 月額目安 |
|---|---|---|
| クライアントのアプリ本体 | **Render（Web Service・Starter・常時起動）** | ¥1,050/社 |
| クライアントのDB | **共有 PostgreSQL（Neon 等）に db-per-client** | 限界費用≈¥0 |
| 計測 / 画像 / 公開LP | **Cloudflare（Worker / R2 / 静的・無料枠）** | ¥0（共有） |
| 定期実行（予約/シナリオ） | **Render Cron** → `/api/scenarios/run` 数分毎 | ¥0 |
| 運営コンソール | Render Starter 1台＋Supabase `lcall`（台帳） | ¥1,050＋¥0（共有） |
| LINE | クライアント自前（BYO） | ¥0（当社） |

> Renderに東京は無く最寄りはシンガポール（実用上問題なし）。コスト最優先・国内重視なら Fly.io 東京（従量）へ。
> DBは file アダプタでも可（最安）。共有Postgresは接続数に注意＝`PG_POOL_MAX=3`（provisionが付与）。

## 運営アカウント（保有モデル＝確定）

**LCall運営の専用 Google アカウント1つ**で全クライアントのインフラを保有・管理する（個人アカウントとは分離・**2段階認証必須**）。クライアントは**アプリにログインするだけ**（インフラは触らない）。インフラ費は運営持ち＝プラン料金に内包（SaaS型）。

この運営アカウントでサインイン／契約するサービス（**作成・サインインはすべて手動操作**）：
- **GitHub**（コード・Render連携）／**Render**（各クライアントのアプリ）／**Neon**（共有Postgres・db-per-client）／**Cloudflare**（公開LP・計測Worker・R2・DNS）／**Supabase**（運営コンソールの台帳DB `lcall`）。
- 必要時：**Stripe**（決済・**LCall名義でKYC**＝Googleアカウントだけでは完結しない）／**Anthropic**（AI・APIキー）。

引き渡しが必要になったクライアントは、個別に③（専用DB）＋別アカウントへ移管（別途設計）。データ保存先は Postgres（Sheetsではない）。

## 手順

### 0. 事前（クライアントDBを用意）
共有Postgres（Neon等）に **このクライアント専用のデータベース**を作成し、接続文字列（`postgresql://…`）を控える。
- 例（psql）: `CREATE DATABASE lcall_acme;` → そのDBの接続URLを使用。
- スキーマ（`lcall_kv`）はアプリ初回起動時に自動作成されるため、DDLは不要。

### 1. 発行（チェック: 発行）
運営コンソール `/operator/clients/new` で発行 → 台帳に `ClientAccount`＋`ClientInstance`（運営キー生成）。
詳細画面に provision コマンドが出る。手元で実行（DBを使う場合は `--database-url` を付ける）:

```
npm run provision -- <slug> --base-url <公開URL> --email <client@example.com> \
  --operator-key <詳細画面の運営キー> --database-url "postgresql://…/lcall_<slug>"
```

→ `clients/<slug>/.env` 生成（**初期ログインPWが一度だけ表示**＝安全に控える）。
`--database-url` 省略時は file アダプタ（`clients/<slug>/data.json`）。

### 2. デプロイ（チェック: デプロイ）
前提：コードは **GitHub** に置く（Render が連携）。Node は **20+**（`.node-version`/`engines` で固定済み）。
1. GitHub にリポジトリを作成し push（`.env*`・`clients/`・`.data` は .gitignore 済みなので秘密は上がらない）。
2. Render → New → **Web Service**（または `render.yaml` の Blueprint）。
   - Build: `npm install && npm run build` ／ Start: `npm run start` ／ Plan: **Starter（常時起動）** ／ Region: Singapore ／ Health Check: `/login`。
   - **環境変数**：`clients/<slug>/.env` の中身を貼る（`DATABASE_URL`/`LCALL_SESSION_SECRET`/`LCALL_WORKER_KEY`/`LCALL_OPERATOR_KEY`/`LCALL_ADMIN_EMAIL`/`LCALL_ADMIN_PASSWORD_HASH`/`PG_POOL_MAX=3` など）。**`PORT` は登録しない**（Render が自動注入し `next start` が `$PORT` を使う）。
3. 固定HTTPSのURLを控え、**コンソールのクライアント詳細「公開URL」に設定**。
4. Render → **Cron Job** で `curl "<公開URL>/api/scenarios/run?key=<LCALL_WORKER_KEY>"` を5分毎（予約配信・シナリオ発火）。

### 3. LINE接続（チェック: LINE接続）
クライアントのLINE公式アカウントの Channel ID / Secret / アクセストークンを、管理画面「LINEアカウント」で登録。
表示される **Webhook URL（`<公開URL>/api/line/webhook/<lineAccountId>`）を LINE Developers に設定**＋Webhook有効化。
（友だち追加→あいさつが届くことを確認）

### 4. 決済 / AI（チェック: 決済設定 / AI設定・任意）
- Stripe：`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` を設定（本番）。`<公開URL>/api/stripe/webhook` をStripeに登録。
- AI：`ANTHROPIC_API_KEY` を設定し、AIキャラ／FAQを作成（¥3/応対の従量）。
- 画像をLINEで使うなら R2（`R2_*`）を設定（HTTPS画像が必須）。

### 5. 初期シナリオ（チェック: 初期シナリオ構築・任意）
あいさつ＋ステップ配信などの初期シナリオを構築（設定代行プランの範囲）。

### 6. 引き渡し（チェック: 引き渡し）
クライアントへ共有：
- 管理画面URL（`<公開URL>/login`）＋初期ログイン情報（メール＋初期PW・初回変更を案内）
- クライアント用マニュアル（`docs/manual/LCall-使い方マニュアル.pdf`）

→ コンソールのチェックリストで必須ステップ（発行/デプロイ/LINE接続/引き渡し）が揃うと **「納品済み」**。台帳の `状態` を `active` に。

## 監視・遠隔操作（納品後）
- コンソールのクライアント詳細「今すぐ確認」で health/metrics を取得（友だち/配信/MRR等）。
- 障害・未払い時は「配信を一時停止／再開」で遠隔制御（運用フラグ）。

## DBを②→③へ昇格（育ったクライアントを専用DBへ）
アプリのコード変更は不要（接続文字列ベース）。
1. 専用Postgresを用意（Neon/Supabase等）。
2. `pg_dump <現DB> | pg_restore <新DB>`（スキーマは `lcall_kv` 単一なので単純）。
3. そのクライアントのインスタンスの `DATABASE_URL` を新DBに差し替えて再起動。
他クライアントは無停止・無影響。逆（③→②）も同様。

## コスト早見（概算・税込/月・要確認）
- 運営固定（全社共有）：≈¥1,200〜¥4,200（コンソール＋共有Postgres＋ドメイン）。
- クライアント毎：アプリ¥1,050＋DB≈¥0＋Stripe手数料（売上の約3.6%）。
- 採算例（Lite ¥9,800）：粗利 ≈¥8,400/月（人件費前）＋初期¥50,000。
