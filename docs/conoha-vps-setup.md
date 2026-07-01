# ConoHa VPS セットアップ手順（② マルチテナント・PostgreSQL同居・Neon不要）

`lcall.shop` を **ConoHa VPS 1台**で運用する構成。アプリ（運営＋クライアント用）＋PostgreSQL を同居させ、
前段に Cloudflare を置く。**クライアントが増えてもサーバーは1台のまま**（申込で `lcall_<slug>` DB が自動作成）。

> Render/Neon 版は `docs/multi-tenant-setup.md`。本書は VPS＋ローカルPG版（コスト0・国内）。

## 構成図
```
[利用者] ─▶ Cloudflare（WAF/DDoS/SSL・Origin証明書で *.lcall.shop 対応）
   lcall.shop / app.lcall.shop ─▶ nginx :443 ─▶ 127.0.0.1:3001（運営/申込＝next start・LCALL_CONTROL_PLANE=true）
   *.lcall.shop                ─▶ nginx :443 ─▶ 127.0.0.1:3000（クライアント＝node server.mjs）
                                                        │
                                              PostgreSQL(127.0.0.1:5432)
                                                lcall（台帳）＋ lcall_<slug>（各クライアント）
```
- サーバー＝ConoHa VPS **1台**（メモリ2GB以上推奨。Node＋PG＋nginx同居）。
- DBは同居PostgreSQL。**申込→`CREATE DATABASE lcall_<slug>`→即開通**（`LCALL_PG_ADMIN_URL` を運営に設定）。

---

## Step 1. VPS作成・初期化
1. ConoHa VPS を作成：**Ubuntu 24.04 LTS**、2GB/3コア以上、SSH鍵を登録。
2. SSHログイン後、更新と作業ユーザー作成：
```bash
sudo apt update && sudo apt -y upgrade
sudo adduser --disabled-password --gecos "" lcall
sudo usermod -aG sudo lcall
sudo rsync -a ~/.ssh /home/lcall/ && sudo chown -R lcall:lcall /home/lcall/.ssh
```
3. ファイアウォール（**5432は開けない＝PGは非公開**）：
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## Step 2. Node 20 インストール
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
node -v   # v20.x
```

## Step 3. PostgreSQL 同居（localhostのみ）
```bash
sudo apt install -y postgresql
# 管理ロール（CREATEDB権限＝テナントDBを作れる）と台帳DBを作成
sudo -u postgres psql -c "CREATE ROLE lcall_admin LOGIN PASSWORD 'ここに強いパスワード' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE lcall OWNER lcall_admin;"
```
- Ubuntu 既定で `listen_addresses='localhost'`＝外部非公開。`127.0.0.1` からはパスワード認証（scram）で接続可。
- 接続URL（この後 env で使用）：
  - 台帳：`postgres://lcall_admin:PW@127.0.0.1:5432/lcall`
  - 管理（CREATE DATABASE用）：`postgres://lcall_admin:PW@127.0.0.1:5432/postgres`
  - テナントは自動で `.../lcall_<slug>` が作られる。

## Step 4. アプリ配置・ビルド
```bash
sudo mkdir -p /opt/lcall && sudo chown lcall:lcall /opt/lcall
sudo -u lcall git clone <このリポジトリのGit URL> /opt/lcall
cd /opt/lcall
sudo -u lcall git checkout main   # フェーズ3をmainにマージ後
sudo -u lcall npm ci
sudo -u lcall npm run build
```

## Step 5. env ファイル（2つ）
`/opt/lcall/.env.control`（運営＝申込HP・コントロールプレーン。**秘密**・chmod 600）：
```ini
LCALL_CONTROL_PLANE=true
DATABASE_URL=postgres://lcall_admin:PW@127.0.0.1:5432/lcall
LCALL_PG_ADMIN_URL=postgres://lcall_admin:PW@127.0.0.1:5432/postgres
PGSSL_DISABLE=true
LCALL_TENANT_BASE_DOMAIN=lcall.shop
LCALL_PUBLIC_BASE_URL=https://app.lcall.shop
LCALL_SESSION_SECRET=<ランダム長文字列>
LCALL_ADMIN_EMAIL=<運営ログインのメール>
LCALL_ADMIN_PASSWORD_HASH=<npm run hash-password の出力>
LCALL_ALLOW_DEV_LOGIN=false
STRIPE_SECRET_KEY=<開発者Stripe・sk_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
PG_POOL_MAX=5
PORT=3001
```
`/opt/lcall/.env.tenant`（クライアント用・マルチテナント。**秘密**・chmod 600）：
```ini
LCALL_TENANT_BASE_DOMAIN=lcall.shop
LCALL_REGISTRY_DATABASE_URL=postgres://lcall_admin:PW@127.0.0.1:5432/lcall
PGSSL_DISABLE=true
LCALL_SESSION_SECRET=<ランダム長文字列（controlと別でも可）>
ANTHROPIC_API_KEY=<共有・AI自動応答¥3/応対>
LCALL_WORKER_KEY=<cron用ランダム>
PG_POOL_MAX=2
# LCALL_PUBLIC_BASE_URL は設定しない（各テナントのURLはHostから自動導出）
# LCALL_CONTROL_PLANE も設定しない（→ /signup・/operator はこのプロセスでは404/非表示）
PORT=3000
```
```bash
sudo chmod 600 /opt/lcall/.env.control /opt/lcall/.env.tenant
sudo chown lcall:lcall /opt/lcall/.env.*
```
> 画像：VPSはディスクが永続するため `public/uploads`（ローカル保存）がそのまま使え、`<slug>.lcall.shop/uploads/..` がHTTPSで配信される（カルーセルのHTTPS要件も満たす）。R2は任意。

## Step 6. systemd（常駐・自動再起動）
`/etc/systemd/system/lcall-control.service`：
```ini
[Unit]
Description=LCall control plane (operator + signup)
After=network.target postgresql.service
[Service]
User=lcall
WorkingDirectory=/opt/lcall
EnvironmentFile=/opt/lcall/.env.control
ExecStart=/usr/bin/node ./node_modules/next/dist/bin/next start -p 3001
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
```
`/etc/systemd/system/lcall-tenant.service`：
```ini
[Unit]
Description=LCall tenant app (multi-tenant server.mjs)
After=network.target postgresql.service
[Service]
User=lcall
WorkingDirectory=/opt/lcall
EnvironmentFile=/opt/lcall/.env.tenant
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lcall-control lcall-tenant
sudo systemctl status lcall-control lcall-tenant --no-pager
```

## Step 7. nginx（ホスト名でルーティング）
```bash
sudo apt install -y nginx
sudo mkdir -p /etc/ssl/cloudflare
```
`/etc/nginx/sites-available/lcall`：
```nginx
# 共通プロキシヘッダ（server.mjs は X-Forwarded-Host からテナント解決）
map $http_upgrade $connection_upgrade { default upgrade; "" close; }

server {  # 運営＋申込（apex / app）
  listen 443 ssl;
  http2 on;
  server_name lcall.shop app.lcall.shop;
  ssl_certificate     /etc/ssl/cloudflare/lcall.pem;
  ssl_certificate_key /etc/ssl/cloudflare/lcall.key;
  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}

server {  # クライアント（ワイルドカード）
  listen 443 ssl;
  http2 on;
  server_name *.lcall.shop;
  ssl_certificate     /etc/ssl/cloudflare/lcall.pem;
  ssl_certificate_key /etc/ssl/cloudflare/lcall.key;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}

server {  # HTTP→HTTPS
  listen 80;
  server_name lcall.shop *.lcall.shop;
  return 301 https://$host$request_uri;
}
```
> nginx は完全一致（`app.lcall.shop`）をワイルドカード（`*.lcall.shop`）より優先するので、apex/app は運営へ、その他サブドメインはクライアントへ振り分く。

```bash
sudo ln -s /etc/nginx/sites-available/lcall /etc/nginx/sites-enabled/lcall
sudo rm -f /etc/nginx/sites-enabled/default
# ※ Origin証明書（Step 8）を置いてから nginx -t → reload
```

## Step 8. Cloudflare（DNS＋SSL＋Origin証明書）
1. **DNS**（プロキシON＝オレンジ雲）：
   - `A`/`CNAME` `lcall.shop` → VPSのIP（`A @ <VPS_IP>`）。
   - `A` `app` → `<VPS_IP>`。
   - `A` `*` → `<VPS_IP>`（ワイルドカード）。
2. **SSL/TLS → 概要 → 「Full (strict)」**。
3. **SSL/TLS → Origin Server → Create Certificate** → ホスト名に `lcall.shop, *.lcall.shop` → 発行。
   - 証明書を `/etc/ssl/cloudflare/lcall.pem`、秘密鍵を `/etc/ssl/cloudflare/lcall.key` に保存（`chmod 600`）。
```bash
sudo nginx -t && sudo systemctl reload nginx
```
> Cloudflare の Origin 証明書は `*.lcall.shop` を無料でカバーし15年有効＝Let's Encrypt のワイルドカード更新が不要。

## Step 9. 動作確認
1. `https://app.lcall.shop/login`（運営ログイン）→ `/operator/clients`。
2. `https://app.lcall.shop/signup` で申込（希望サブドメイン・メール・パスワード・プラン）。
   - `LCALL_PG_ADMIN_URL` があるので **専用DB `lcall_<slug>` が自動作成**＋オーナー作成＋台帳登録＝即開通。
3. `https://<slug>.lcall.shop/login` にそのメール＋パスワードでログイン（テナント分離）。
4. 運営コンソールのクライアント詳細「自動開通」カードで状態確認・再実行可。

## Step 10. デプロイ（更新）
`/opt/lcall/deploy.sh`：
```bash
#!/usr/bin/env bash
set -e
cd /opt/lcall
git pull
npm ci
npm run build
sudo systemctl restart lcall-control lcall-tenant
echo "deployed."
```
```bash
chmod +x /opt/lcall/deploy.sh
# 更新時： sudo -u lcall /opt/lcall/deploy.sh
```

## Step 11. バックアップ（重要・単一障害点対策）
VPS同居DBは可用性が1台に依存するため、**必ず自動バックアップ**を。
```bash
sudo mkdir -p /var/backups/lcall
sudo crontab -e
# 毎日3時に全DBをダンプ（14日保持）。可能なら rclone で R2/別ストレージへ複製
0 3 * * * sudo -u postgres pg_dumpall | gzip > /var/backups/lcall/pg-$(date +\%F).sql.gz && find /var/backups/lcall -name 'pg-*.sql.gz' -mtime +14 -delete
```
> 余裕があれば `rclone` で Cloudflare R2 等へ日次コピー（オフサイト）を推奨。

## Step 12. Cron（配信・シナリオ発火）
```bash
# 5分毎に予約配信＋シナリオを発火（tenant側・任意テナントで叩く or 内部）
*/5 * * * * curl -s "https://<任意の稼働テナント>.lcall.shop/api/scenarios/run?key=<LCALL_WORKER_KEY>" >/dev/null
```

## Cloudflare セキュリティ（推奨）
- WAF マネージドルール ON。
- レート制限：`/login`・`/signup`・`/api/*/webhook`（Stripe/LINEの正規Webhookは署名検証済みなので必要なら除外）。

## 運用の要点
- **クライアント数が増えてもサーバーは1台・作業は増えない**（申込でDBが増えるだけ）。
- 増える運用は「OS更新（月イチ）」「バックアップ監視」「証明書は15年不要」程度＝固定。
- 負荷が上がったら VPS のプラン増強、または将来クライアント用プロセスを別VPSへ分離可能（台帳DBを共有すればスケールアウトできる設計）。
