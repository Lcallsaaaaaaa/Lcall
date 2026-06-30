# ② マルチテナント構成 セットアップ手順（ドメイン取得 → 本番）

「1アプリ＋クライアント別DB（②）」を、Cloudflare 前段・Render・Neon で立ち上げる手順。
クライアントが増えてもサーバーは固定（1〜2台）、ドメインは1つで全社を収容する。

> 現状：**テナント振り分け（フェーズ1）は実装済み**（`server.mjs`／`src/lib/tenant.ts`）。
> **申込→自動開通（フェーズ3：動的レジストリ＋Neon自動作成＋申込HP）は未実装**。
> 本手順で**インフラを用意**し、当面のテナント追加は「env登録＋Neon DB作成」の半手動。フェーズ3完成で全自動になる。

## 全体像
```
[利用者/クライアント] ─▶ Cloudflare（前段・DDoS/WAF/SSL/秘匿）
   *.lcall.example ─▶ Render: クライアント用アプリ（node server.mjs・全社共有）─▶ Neon（テナント別DB）
   app.lcall.example ─▶ Render: 運営コンソール＋申込HP（LCALL_CONTROL_PLANE=true）─▶ Neon: lcall（台帳）
                                         └ 開発者Stripe（システム料Webhook）
```
- サーバー＝Render Web Service **2台固定**（クライアント用／運営）。
- DB＝Neon 1アカウント（マネージド・テナント別DBをAPIで量産）。
- ドメイン＝1つ（ワイルドカード `*.ドメイン`）。

## Step 1. ドメイン取得
- 好きなTLDで1つ取得（`.com` がコスパ良。`.jp`/`.app` 等でも可）。例：`lcall.example`。
- クライアント数に関係なく**1つだけ**でよい（ワイルドカードで全社収容）。

## Step 2. Cloudflare（前段・DNS）
1. Cloudflare にドメインを追加 → レジストラのネームサーバを Cloudflare のものに変更。
2. DNSレコード（**プロキシON＝オレンジ雲**）：
   - `app`（または apex）→ 運営コンソール/HP の Render ホスト（CNAME）。
   - `*`（ワイルドカード）→ クライアント用アプリの Render ホスト（CNAME）。
3. SSL/TLS：**「Full (strict)」**（Flexible 不可）。Universal SSL は `*.ドメイン`（1段）を無料カバー。
4. セキュリティ：WAF マネージドルール ON＋**レート制限**を `/login`・`/signup`・`/api/*/webhook` に。
   - ※ LINE/Stripe の正規 Webhook を誤ブロックしないよう、必要なら除外ルール（署名検証はアプリ側で必須・実装済み）。

## Step 3. Neon（DB・マネージド）
1. Neon アカウント作成（運営の専用Googleで）。
2. プロジェクト作成。**接続文字列は「Pooled connection（pgBouncer）」**を使う（多テナントの接続枯渇回避。コードは `prepare:false` 設定済み）。
3. 台帳用DB `lcall` を作成（運営コンソール用）。
4. クライアント別DBは当面手動作成（`lcall_<slug>`）。フェーズ3で **Neon API により自動作成**。

## Step 4. Render ①：運営コンソール＋申込HP
- New → Web Service（このリポジトリ）。Build `npm install && npm run build` ／ Start `npm run start`（単一テナントで可）。
- 環境変数：

  | 変数 | 値 |
  |---|---|
  | `LCALL_CONTROL_PLANE` | `true` |
  | `DATABASE_URL` | Neon `lcall`（Pooled） |
  | `LCALL_SESSION_SECRET` | ランダム長文字列 |
  | `LCALL_ADMIN_EMAIL` / `LCALL_ADMIN_PASSWORD_HASH` | 運営ログイン（`npm run hash-password`） |
  | `LCALL_ALLOW_DEV_LOGIN` | `false` |
  | `LCALL_PUBLIC_BASE_URL` | `https://app.ドメイン` |
  | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | **開発者のStripe**（システム料） |
  | `PG_POOL_MAX` | `3` |

- 開発者Stripe の Webhook を **`https://app.ドメイン/api/stripe/webhook`** に登録（`checkout.session.completed`/`invoice.paid`/`customer.subscription.deleted`）。
- Cloudflare の `app` をこの Render ホストへ。台帳＝`/operator/clients`。

## Step 5. Render ②：クライアント用アプリ（全社共有・マルチテナント）
- New → Web Service（同リポジトリ）。Build 同上 ／ Start **`npm run start:tenant`（＝`node server.mjs`）**。
- **カスタムドメインに `*.ドメイン`（ワイルドカード）を追加**（Cloudflare 経由）。
- 環境変数：

  | 変数 | 値 / 備考 |
  |---|---|
  | `LCALL_TENANT_BASE_DOMAIN` | `ドメイン`（例 `lcall.example`）。`<slug>.ドメイン` の slug を解決 |
  | `LCALL_TENANTS` | （フェーズ1）テナント一覧JSON `{"acme":{"databaseUrl":"<NeonのacmeDB・Pooled>"}}`。**フェーズ3で台帳DBから動的取得に置換** |
  | `LCALL_SESSION_SECRET` | ランダム長文字列 |
  | `LCALL_PUBLIC_BASE_URL` | **未設定にする**（各テナントの公開URLを Host から自動導出させるため） |
  | `ANTHROPIC_API_KEY` | 共有（全テナントのAI応答。¥3/応対で課金） |
  | `R2_*` | 画像（共有バケット） |
  | `PG_POOL_MAX` | `2`（テナント別プールが増えるため小さく） |
  | `LCALL_WORKER_KEY` | cron 用 |

- 注意：このアプリは **`*.ドメイン`（テナント）専用**。apex/`app` は運営側へ。`STRIPE_*`（予約決済）は env に置かず、各クライアントが管理画面 `/settings` に自分のキーを貼る。
- Cron：`https://<任意テナント or 内部>/api/scenarios/run?key=...` を5分毎（配信/シナリオ発火。負荷増時は別Workerへ）。

## Step 6. 動作確認
1. `https://app.ドメイン/login` で運営ログイン → `/operator/clients` 表示。
2. テスト用に Neon で `lcall_demo` を作り、②アプリの `LCALL_TENANTS` に `{"demo":{"databaseUrl":"…"}}` を登録 → 再デプロイ。
3. `https://demo.ドメイン/login` がそのテナント専用システムとして開く（データは demo 専用）。
4. 別 slug でデータが混ざらないこと（テナント分離）を確認。

## Step 7. フェーズ3（コード・これから実装）＝全自動化
- 申込HP（`app.ドメイン`）に **直販＋アフィリ任意** の申込ページ。
- 成約Webルック → **ClientAccount作成＋Neon APIで専用DB作成＋テナント登録（台帳DB＝動的レジストリ）** → `<slug>.ドメイン` 即開通。
- これで `LCALL_TENANTS` の手編集・再デプロイが不要になり、**申込だけでクライアントのシステムが自動生成**される。
- 実Neon検証に **Neon APIキー** が必要（運営コンソール env `NEON_API_KEY` 等）。

## コスト早見（固定・要確認）
- Render ②（クライアント用・Standard 目安）≈ $25 ＋ Render ①（運営・Starter）≈ $7 ＋ Neon（無料〜$19）＋ ドメイン ≈ ¥1,500/年 ＋ Cloudflare（無料枠）。
- **クライアントが増えてもこの固定費のまま**（DB1個＋テナント1行が増えるだけ）。
