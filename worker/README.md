# LCall Tracker（Cloudflare Worker）

クリック計測URL `/r/:trackingId` を処理する Worker。リンク表は KV にキャッシュ（Next から遅延補充）、
クリックは `ctx.waitUntil` で Next の取込API（`/api/clicks/ingest`）へ非同期送信する。

## ローカル開発（Cloudflareアカウント不要）

```bash
cd worker
npm install
npm run dev          # http://localhost:8787 （Miniflare のローカルKV）
```

別ターミナルで Next を起動（`npm run dev`、:3000）。Next の `.env.local` に:

```
TRACKING_BASE_URL=http://localhost:8787
LCALL_WORKER_KEY=lcall-dev-worker-key
```

動作確認:

```bash
curl -i "http://localhost:8787/r/<trackingId>?u=<friendId>"
# → 302 / Location: <targetUrl>?...&openExternalBrowser=1
```

`WORKER_KEY` は `wrangler.toml [vars]` の値と Next 側 `LCALL_WORKER_KEY` を一致させること。

## 本番デプロイ

```bash
wrangler login
wrangler kv namespace create LINKS      # 出力された id を wrangler.toml の [[kv_namespaces]].id に設定
wrangler secret put WORKER_KEY          # [vars] ではなく secret 推奨
# wrangler.toml の NEXT_BASE_URL を本番Nextのオリジンに変更
npm run deploy
```

デプロイ後、Next 側 `TRACKING_BASE_URL` を Worker の公開URL（例 `https://lcall-tracker.<account>.workers.dev`）に設定する。

## スケール時の発展

高頻度クリックで Next 取込が重くなる場合は、Cloudflare Queues / Durable Objects（有料）でエッジ側バッファ＋バッチ取込に拡張する。現状は無料枠前提で waitUntil の非同期POST。
