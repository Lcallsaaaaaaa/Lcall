# LCall デモ環境のセットアップ

問い合わせをいただいた方に「限定URL」で送って、実際に触ってもらうためのデモ環境です。
**本番キーを入れない**ことで、AI生成・課金・LINE送信は一切実行されない安全なサンドボックスになります。

## 安全設計（なぜ安全か）

- **本番キーを設定しない** → AI（Anthropic）・決済（Stripe）・LINE送信はすべて無効のまま（コードがキー未設定を検知して実行しない）
- **メモリデータ** → デモデータ（ダミーの友だち・配信・シナリオ等）が初期表示され、再起動でリセット
- **ワンクリックlog in** → ログイン画面の「開発用ログインで入る（ダミーデータ）」から入れる（メール/パスワード不要）
- 画面上部に「**これはデモ環境です**」のバナーを常時表示（`LCALL_DEMO=true`）

## 環境変数（デモ用）

```
LCALL_DEMO=true                # デモバナー表示
LCALL_ALLOW_DEV_LOGIN=true     # ワンクリックlog in
LCALL_DATA_ADAPTER=upstash     # ★Vercel等サーバーレスでは upstash（全インスタンス共通の保存先）
UPSTASH_REDIS_REST_URL=...     # Upstash Redis の REST URL
UPSTASH_REDIS_REST_TOKEN=...   # Upstash Redis の REST Token
LCALL_SESSION_SECRET=<ランダムな長い文字列>
# ↓ 本番キーは「入れない」（入れると実際に動いてしまうため）
# ANTHROPIC_API_KEY / STRIPE_SECRET_KEY / LINE系 / R2系 は未設定のまま
```

### なぜ Upstash が必要か（重要）
Vercel等のサーバーレスは**リクエストごとに別インスタンス**が応答するため、`memory` アダプタだと
「作成した直後の別ページ表示」が作成データを持たない別インスタンスに当たり **404** になる。
データを全インスタンス共通の Upstash Redis に置くと、作成・編集が正しく反映される。

- Upstash（[console.upstash.com](https://console.upstash.com)）で無料の Redis DB を作成 → 「REST API」欄の URL と TOKEN をコピー。
- デモ初回アクセス時にデモデータが自動投入される（以後は共通データ。リセットしたい場合は Upstash 側でキー `lcall:db` を削除）。
- ※ 常時起動ホスト（Render等・1プロセス）に置く場合は `memory` のままでも一貫する（Upstash不要）。

## デプロイ手順（Vercel・無料・GitHub不要が最簡単）

Next.js アプリなので、静的サイト用のCloudflareではなく、Next対応の無料ホストにデプロイします。

```bash
cd C:\Users\sames\Desktop\lcall
npx vercel            # 初回はログイン（メール認証）→ そのままデプロイ
```

1. デプロイ後、Vercelダッシュボード → 該当プロジェクト → **Settings → Environment Variables** に上記の環境変数を登録
   - プロジェクト名は個人名を避ける（例 `lcall-demo` → `lcall-demo.vercel.app`）
2. **Redeploy**（環境変数を反映）
3. 発行された `https://lcall-demo.vercel.app` を問い合わせ者に送る

> 補足：Vercelはサーバーレスのため、デモ中に作成したデータは時々リセットされます（＝常にきれいなデモに戻るので好都合）。
> 「作成したデータがセッション中ずっと残る」一貫性が欲しい場合は、永続プロセスで動く **Render**（無料・GitHub連携）に同じ環境変数でデプロイしてください。

## 送付メールの文例

```
このたびはお問い合わせありがとうございます。
LCall を実際に体験いただけるデモをご用意しました。

▼デモはこちら
https://lcall-demo.vercel.app

・ログイン画面の「開発用ログインで入る（ダミーデータ）」を押すだけで入れます
・サンプルデータで、配信・チャット・AI設定・分析などを自由にお試しいただけます
・デモ環境のため、実際のメッセージ送信や課金は行われません

ご不明点はこのメールにご返信ください。
```

## 注意

- デモURLは「問い合わせ者へ個別送付」用です（公開LPには載せません）。
- 本番の顧客データは入れないでください（デモはダミーデータのみ）。
- 不要になったらVercel/Renderのプロジェクトを削除すれば停止できます。
