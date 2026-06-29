#!/usr/bin/env node
/**
 * モデルB（1クライアント＝1インスタンス）の納品用プロビジョニング。
 * クライアント専用の「データファイル＋ユニークな秘密鍵＋env」を1コマンドで生成する。
 *
 *   node scripts/provision-client.mjs <client-slug> [--port 3001] [--base-url https://client.example.com]
 *   npm run provision -- <client-slug> --port 3001
 *
 * 生成物: clients/<slug>/.env（秘密情報・コミット禁止＝.gitignore済み）
 *         データは初回起動時に clients/<slug>/data.json として空で自動作成。
 */
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function hashPassword(plain) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

// プロジェクトルート（このスクリプトの1つ上）。cwd に依存せず clients/ をルート直下に作る。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const slug = process.argv[2];
if (!slug || slug.startsWith("--") || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("使い方: node scripts/provision-client.mjs <client-slug> [--port 3001] [--base-url https://...] [--email a@b.jp] [--operator-key KEY] [--database-url postgres://...]");
  console.error("  slug は英小文字・数字・ハイフン（例: acme-corp）");
  console.error("  --database-url 指定で PostgreSQL 永続化（推奨）。未指定は file アダプタ。");
  process.exit(1);
}

const port = arg("port", "3000");
const baseUrl = arg("base-url", `http://localhost:${port}`).replace(/\/$/, "");
const adminEmail = arg("email", "");
// --database-url を渡すと PostgreSQL 永続化（本番・推奨）。未指定なら file アダプタ。
// 値は後で .env に貼っても良い（プレースホルダとして任意文字列を渡すか、空のまま編集）。
const databaseUrl = arg("database-url", "");

const clientDir = path.join(root, "clients", slug);
const dataFile = `clients/${slug}/data.json`;

if (existsSync(clientDir)) {
  console.error(`既に存在します: clients/${slug}（上書きしません）`);
  process.exit(1);
}
mkdirSync(clientDir, { recursive: true });

const secret = (n) => randomBytes(n).toString("hex");
const initialPassword = randomBytes(9).toString("base64url"); // 初期ログインパスワード（後で変更推奨）
const passHash = hashPassword(initialPassword);
// 運営コンソール↔このインスタンスの共有シークレット。コンソール発行時は --operator-key で一致させる。
const operatorKey = arg("operator-key", secret(24));

const persistence = databaseUrl
  ? `# --- 永続化（PostgreSQL：本番・推奨。共有1台にdb-per-client 等） ---
DATABASE_URL=${databaseUrl}
# 共有Postgresでは接続数を抑える（Neon等プーラ利用時もこのままで安全）
PG_POOL_MAX=3`
  : `# --- 永続化（このインスタンス専用ファイル＝完全分離） ---
LCALL_DATA_ADAPTER=file
LCALL_DATA_FILE=./${dataFile}
LCALL_SEED=empty`;

const env = `# LCall クライアント「${slug}」インスタンス設定（自動生成）。秘密情報を含む＝コミット禁止。
${persistence}
# --- 認証・基盤 ---
LCALL_SESSION_SECRET=${secret(24)}
LCALL_WORKER_KEY=${secret(16)}
# 運営コンソール（コントロールプレーン）からの監視・遠隔操作用の共有シークレット
LCALL_OPERATOR_KEY=${operatorKey}
LCALL_ALLOW_DEV_LOGIN=false
# 公開URL（共有リンク・Webhook URL・登録URL等の組み立てに使用。プロキシ背後の内部ホスト混入を防ぐ）
LCALL_PUBLIC_BASE_URL=${baseUrl}
PORT=${port}
# --- 本番ログイン（登録メール＋パスワード）---
LCALL_ADMIN_EMAIL=${adminEmail}
LCALL_ADMIN_PASSWORD_HASH=${passHash}
# パスワード変更時: npm run hash-password -- '新パスワード' の出力を上に貼り再起動
# 任意: Google OAuth も併用するなら（許可メールのみ）
# LCALL_ALLOWED_EMAILS=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REDIRECT_URI=${baseUrl}/api/auth/google/callback
# クリック計測（このクライアント用Workerを立てたらそのURL）
TRACKING_BASE_URL=
# --- 契約・請求（システム料）。申込時にStripeで採番した顧客IDを引き継ぐと、
#     納品前の支払いと、このインスタンスの請求(BillingCustomer)が同一顧客として紐づく ---
LCALL_BILLING_CUSTOMER_ID=
LCALL_BILLING_PLAN=
# --- クライアントごとに値を貼る（任意） ---
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
`;

writeFileSync(path.join(clientDir, ".env"), env, "utf8");

console.log(`✓ クライアント「${slug}」を作成しました`);
if (databaseUrl) {
  console.log(`  設定: clients/${slug}/.env  /  データ: PostgreSQL（DATABASE_URL・起動時に lcall_kv を自動作成・空で開始）`);
} else {
  console.log(`  設定: clients/${slug}/.env  /  データ: ${dataFile}（file・初回起動時に空で自動生成）`);
}
console.log("");
console.log("起動（本番ビルド後・Node 20.6+ の --env-file を使用）:");
console.log(`  npm run build`);
console.log(`  node --env-file=clients/${slug}/.env ./node_modules/next/dist/bin/next start`);
console.log("");
console.log("クライアント案内URL:");
console.log(`  ログイン       : ${baseUrl}/login`);
console.log(`  契約・請求     : ${baseUrl}/billing`);
console.log(`  Stripe Webhook : ${baseUrl}/api/stripe/webhook`);
console.log(`  LINE Webhook   : ${baseUrl}/api/line/webhook/{lineAccountId}（LINEアカウント作成後に確定）`);
console.log("");
console.log("■ 初期ログイン情報（クライアントへ安全に共有。初回ログイン後の変更推奨）");
console.log(`  メール     : ${adminEmail || "（未設定 → .env の LCALL_ADMIN_EMAIL に管理者メールを記入）"}`);
console.log(`  パスワード : ${initialPassword}`);
console.log("  ※ この平文パスワードはここにしか表示されません（保存はハッシュのみ）");
console.log("");
console.log("■ 運営コンソール（コントロールプレーン）連携");
console.log(`  運営キー(LCALL_OPERATOR_KEY): ${operatorKey}`);
console.log("  ※ コンソールの台帳に baseUrl とこのキーを登録すると監視・遠隔操作ができます。");
console.log("    （コンソール発行時は --operator-key で値を一致させてください）");
console.log("");
console.log("次の手順:");
console.log(`  1) clients/${slug}/.env の LCALL_ADMIN_EMAIL を設定（--email 指定済みなら不要）。`);
console.log("     必要に応じて ANTHROPIC_API_KEY / STRIPE_* / R2_* も設定");
console.log("  2) 起動 → /login で 上記メール＋パスワードでログイン（開発ログイン無効）");
console.log("  3) 管理画面でLINEアカウント作成 → 表示Webhook URLをLINE Developersに登録");
console.log("  ※ パスワード変更: npm run hash-password -- '新パス' の出力を LCALL_ADMIN_PASSWORD_HASH に貼り再起動");
