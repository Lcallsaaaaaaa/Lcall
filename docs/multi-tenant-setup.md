# ② マルチテナント構成 セットアップ手順（ドメイン取得 → 本番）

「1アプリ＋クライアント別DB（②）」を、Cloudflare 前段・Render・Neon で立ち上げる手順。
クライアントが増えてもサーバーは固定（1〜2台）、ドメインは1つで全社を収容する。
ドメインは **`lcall.shop`** を使用（apex＝運営/HP/申込、`*.lcall.shop`＝各クライアント）。

> **ConoHa VPS＋同居PostgreSQL版（Neon不要・コスト0）は `docs/conoha-vps-setup.md`。** 本書は Render＋Cloudflare＋Neon 版。

> 状態：**フェーズ1（テナント振り分け）＋フェーズ3（申込→自動開通）まで実装済み**。
> - フェーズ1：`server.mjs` が Host からテナントを解決し ALS で全リクエストに適用。
> - フェーズ3：**動的レジストリ**（`server.mjs` が台帳DBから `slug→databaseUrl` を解決・キャッシュ）＋
>   **Neon API 自動プロビジョニング**（`src/features/operator/{neon,provision}.ts`）＋
>   **公開申込ページ**（`/signup`・直販／`?aff=CODE`・アフィリ）。
> → **申込だけでクライアント専用DBが作られ、`<slug>.lcall.shop` が即開通**（再デプロイ・env手編集なし）。
> 残りは本書の**インフラ設定（ドメイン/Cloudflare/Render/Neon＋APIキー投入）**のみ。

## 全体像
```
[利用者/クライアント] ─▶ Cloudflare（前段・DDoS/WAF/SSL/秘匿）
   *.lcall.shop ─▶ Render: クライアント用アプリ（node server.mjs・全社共有）─▶ Neon（テナント別DB）
                                  ▲ 台帳DBを参照して slug→DB を解決（LCALL_REGISTRY_DATABASE_URL）
   app.lcall.shop ─▶ Render: 運営コンソール＋申込HP（LCALL_CONTROL_PLANE=true）─▶ Neon: lcall（台帳）
                                         ├ 申込（/signup）→ Neon API で専用DB作成＋台帳登録＝即開通
                                         └ 開発者Stripe（システム料Webhook／申込Checkout）
```
- サーバー＝Render Web Service **2台固定**（クライアント用／運営）。
- DB＝Neon 1アカウント（マネージド・テナント別DBをAPIで量産）。
- ドメイン＝1つ `lcall.shop`（ワイルドカード `*.lcall.shop`）。

## Step 1. ドメイン取得（取得済み想定：lcall.shop）
- `lcall.shop` を取得（更新費は要確認・初年度無料の registrar 可）。
- クライアント数に関係なく**1つだけ**でよい（ワイルドカードで全社収容）。
- 役割：`lcall.shop`（apex／必要なら `app.lcall.shop`）＝運営＆申込HP。`*.lcall.shop`＝各クライアント。
  `www`/`app`/`api` 等は予約サブドメイン（`src/lib/slug.ts` の `RESERVED_SLUGS`）でテナントには割り当て不可。

## Step 2. Cloudflare（前段・DNS）
1. Cloudflare にドメインを追加 → レジストラのネームサーバを Cloudflare のものに変更。
2. DNSレコード（**プロキシON＝オレンジ雲**）：
   - apex `lcall.shop`（または `app`）→ 運営コンソール/HP の Render ホスト（CNAME/フラット化）。
   - `*`（ワイルドカード）→ クライアント用アプリの Render ホスト（CNAME）。
3. SSL/TLS：**「Full (strict)」**（Flexible 不可）。Universal SSL は `*.lcall.shop`（1段）を無料カバー。
4. セキュリティ：WAF マネージドルール ON＋**レート制限**を `/login`・`/signup`・`/api/*/webhook` に。
   - ※ LINE/Stripe の正規 Webhook を誤ブロックしないよう、必要なら除外（署名検証はアプリ側で必須・実装済み）。

## Step 3. Neon（DB・マネージド）
1. Neon アカウント作成（運営の専用Googleで）。**APIキーを発行**（自動プロビジョニング用）。
2. プロジェクト作成。**接続文字列は「Pooled connection（pgBouncer）」**を使う（多テナントの接続枯渇回避。コードは `prepare:false` 済み）。
3. 台帳用DB `lcall` を作成（運営コンソール用）。
4. クライアント別DBは**申込時に Neon API で自動作成**（`lcall_<slug>`）。手動作成は不要（フェーズ3実装済み）。
   - 運営 env に `NEON_API_KEY` / `NEON_PROJECT_ID` を入れるだけで自動化が有効になる。

## Step 4. Render ①：運営コンソール＋申込HP（コントロールプレーン）
- New → Web Service（このリポジトリ）。Build `npm install && npm run build` ／ Start `npm run start`。
- 環境変数：

  | 変数 | 値 |
  |---|---|
  | `LCALL_CONTROL_PLANE` | `true` |
  | `DATABASE_URL` | Neon `lcall`（台帳・Pooled） |
  | `LCALL_TENANT_BASE_DOMAIN` | `lcall.shop`（申込で `<slug>.lcall.shop` のURL組み立て・台帳に反映） |
  | `LCALL_PUBLIC_BASE_URL` | `https://app.lcall.shop`（申込Checkoutの戻りURL・アフィリ申込リンク） |
  | `NEON_API_KEY` | Neon APIキー（**運営のみ**・クライアントに渡さない） |
  | `NEON_PROJECT_ID` | 対象プロジェクトID |
  | `NEON_BRANCH_ID` / `NEON_ROLE_NAME` | （任意）未指定なら既定ブランチ/ロールを自動取得 |
  | `LCALL_SESSION_SECRET` | ランダム長文字列 |
  | `LCALL_ADMIN_EMAIL` / `LCALL_ADMIN_PASSWORD_HASH` | 運営ログイン（`npm run hash-password`） |
  | `LCALL_ALLOW_DEV_LOGIN` | `false` |
  | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | **開発者のStripe**（システム料・申込Checkout） |
  | `PG_POOL_MAX` | `3` |

- 申込ページ：**`https://app.lcall.shop/signup`**（直販）／**`/signup?aff=<コード>`**（アフィリ。運営コンソールのアフィリ一覧に各リンク表示）。
- 開発者Stripe の Webhook を **`https://app.lcall.shop/api/stripe/webhook`** に登録
  （`checkout.session.completed`／`invoice.paid`／`customer.subscription.deleted`）。
  申込Checkout は `client_reference_id` で台帳の ClientAccount に顧客ID（cus_…）を自動紐づけ＝申込時の支払いとシステムの連結。
- Cloudflare の apex/`app` をこの Render ホストへ。台帳＝`/operator/clients`。

## Step 5. Render ②：クライアント用アプリ（全社共有・マルチテナント）
- New → Web Service（同リポジトリ）。Build 同上 ／ Start **`npm run start:tenant`（＝`node server.mjs`）**。
- **カスタムドメインに `*.lcall.shop`（ワイルドカード）を追加**（Cloudflare 経由）。
- 環境変数：

  | 変数 | 値 / 備考 |
  |---|---|
  | `LCALL_TENANT_BASE_DOMAIN` | `lcall.shop`。`<slug>.lcall.shop` の slug を解決 |
  | `LCALL_REGISTRY_DATABASE_URL` | **台帳DB `lcall`（Pooled）**。server.mjs が slug→databaseUrl を動的解決（フェーズ3）。これを設定すれば `LCALL_TENANTS` 不要 |
  | `LCALL_TENANTS` | （任意）静的レジストリJSON。テスト/特例の**上書き**用。動的レジストリと併用可 |
  | `LCALL_REGISTRY_TTL_MS` | （任意）解決キャッシュTTL。既定 30000ms |
  | `LCALL_SESSION_SECRET` | ランダム長文字列（**テナント間でCookieはホスト単位に分離**＝共有で安全） |
  | `LCALL_PUBLIC_BASE_URL` | **未設定にする**（各テナントの公開URLを Host から自動導出） |
  | `ANTHROPIC_API_KEY` | 共有（全テナントのAI応答。¥3/応対で課金） |
  | `R2_*` | 画像（共有バケット） |
  | `PG_POOL_MAX` | `2`（テナント別プールが増えるため小さく） |
  | `PG_REGISTRY_POOL_MAX` | （任意）台帳参照プール。既定 2 |
  | `LCALL_WORKER_KEY` | cron 用 |

- 注意：このアプリは **`*.lcall.shop`（テナント）専用**。apex/`app` は運営側へ。
  `STRIPE_*`（予約決済）は env に置かず、各クライアントが管理画面 `/settings` に自分のキーを貼る。
  **`LCALL_CONTROL_PLANE` は設定しない**（→ `/signup`・`/operator` はこのアプリでは 404／非表示）。
- Cron：`https://<任意テナント or 内部>/api/scenarios/run?key=...` を5分毎（配信/シナリオ発火。負荷増時は別Workerへ）。

## Step 6. 動作確認
1. `https://app.lcall.shop/login` で運営ログイン → `/operator/clients` 表示。
2. `https://app.lcall.shop/signup` で申込（事業者名・希望サブドメイン・メール・パスワード・プラン）。
   - Neon設定済みなら：専用DB作成＋オーナー作成＋台帳登録 → 完了画面に `<slug>.lcall.shop/login` 表示。
   - Stripeありなら：そのまま Checkout（サブスク）へ。支払い後 webhook で active＋顧客ID紐づけ＋（紹介なら）初回報酬。
3. `https://<slug>.lcall.shop/login` が**そのテナント専用システム**として開く（申込時のメール＋パスワードでログイン）。
4. 別 slug でデータが混ざらないこと（テナント分離）を確認。
5. 運営コンソールのクライアント詳細「自動開通」カードで状態（開通済み/未開通）と再実行が可能。

## Step 7. 自動化の仕組み（フェーズ3・実装済みの要点）
- **申込**：`/signup`（公開・コントロールプレーン限定）。`?aff=CODE` でアフィリ紐づけ（無効コードは直販扱い）。
  オーナーのパスワードは**申込者本人がフォームで設定**（運営は受け取らない）。
- **自動プロビジョニング**：`provisionTenant()` が
  ① Neon API で専用DB作成（Pooled URI 取得）→ ② そのDBに初期オーナー＋プラン設定を作成 →
  ③ 台帳 `ClientInstance.databaseUrl` に書込（＝この瞬間に開通）。
  Neon 未設定時は**手動モード**（台帳に pending／アプリは壊さない。運営が後でDBを用意し再実行）。
- **動的レジストリ**：`server.mjs` が `LCALL_REGISTRY_DATABASE_URL`（台帳DB）から
  `slug→databaseUrl` を解決（TTLキャッシュ・解約/未割当は振り向けない）。**再デプロイ不要**。
- **決済連結**：申込Checkout の `client_reference_id`＝ClientAccount.id を webhook が引き当て、
  採番された `cus_…` を台帳へ保存。以後の `invoice.paid` で月次レベニューシェアを計上。

## コスト早見（固定・要確認）
- Render ②（クライアント用・Standard 目安）≈ $25 ＋ Render ①（運営・Starter）≈ $7 ＋ Neon（無料〜$19）＋ `lcall.shop` 更新費 ＋ Cloudflare（無料枠）。
- **クライアントが増えてもこの固定費のまま**（Neon DB1個＋台帳1行が増えるだけ）。

## まだ実機検証が必要（あなたの鍵・インフラが必要な項目）
- Neon API での実DB作成＋オーナー作成（`NEON_API_KEY`/`NEON_PROJECT_ID` 投入後）。
- `*.lcall.shop` ワイルドカードの Cloudflare/Render 経由ルーティング（`node server.mjs` 起動）。
- 申込 Stripe Checkout の実決済→webhook 紐づけ（開発者Stripe鍵）。
- 動的レジストリの台帳参照（`LCALL_REGISTRY_DATABASE_URL` 設定後／本番台帳DBに対して）。
  ※ ロジックは本番運用中の postgres アダプタと同一の jsonb クエリで実装。
