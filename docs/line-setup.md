# LINE 受信・返信（Messaging API）の接続手順

チャット対応（`/inbox`）で **実際のユーザーのLINEを受信し、実際に返信する** ための設定。

## 仕組み

```
ユーザーのLINE
   │ メッセージ送信
   ▼
LINE プラットフォーム ── Webhook(POST) ──▶ {公開URL}/api/line/webhook/{lineAccountId}
                                              │ 署名検証(channelSecret) → 受信を保存
                                              ▼
                                         /inbox（受信箱）に表示
   ▲                                          │ スタッフが返信
   │ push 送信(Messaging API)                  ▼
   └────────────────────────  pushText(channelAccessToken, lineUserId, text)
```

- 受信: `src/app/api/line/webhook/[lineAccountId]/route.ts`
- 返信: `src/features/chat/actions.ts` の `sendReply`（本物トークン時に `src/lib/line.ts` の `pushText` を実行）

## 必要なもの（クライアント側で用意）

1. **LINE公式アカウント** と **Messaging API チャネル**（[LINE Developers](https://developers.line.biz/)）
2. **チャネルアクセストークン（長期）** と **チャネルシークレット**
3. アプリの **公開HTTPS URL**（デプロイ済み環境。ローカル検証は cloudflared / ngrok などのトンネル）

## 設定手順

1. 管理画面の **LINEアカウント管理 → 対象アカウントを編集** を開く。
2. **Channel Secret** と **Channel Access Token** を入力して保存。
3. 同画面に表示される **LINE Webhook URL**（`{公開URL}/api/line/webhook/{アカウントID}`）をコピー。
4. LINE Developers コンソール → 対象チャネル → **Messaging API設定**:
   - **Webhook URL** に上記URLを設定
   - **Webhookの利用** を「オン」
   - 「検証」ボタンで疎通確認（200が返ればOK）
   - 応答メッセージ（自動応答）はオフ推奨（手動対応にするため）
5. 友だちがメッセージを送ると `/inbox` に受信が表示され、返信するとユーザーのLINEに届きます。

## ローカルで試す

```bash
# 1) Next を起動
npm run dev
# 2) トンネルで公開（例: cloudflared）
cloudflared tunnel --url http://localhost:3000
#    → https://xxxx.trycloudflare.com が発行される
# 3) LINE Developers の Webhook URL に
#    https://xxxx.trycloudflare.com/api/line/webhook/{アカウントID} を登録
```

> 署名検証は該当アカウントの **Channel Secret** で行います。実トークン（`demo_token` 以外）が
> 設定されている場合のみ、新規受信時のプロフィール取得と返信の push 送信を実行します。

## 本番運用の注意

- 受信データを永続化するには **Sheets アダプタ**（または専用DB）への切替が必要（メモリは揮発）。
- push はユーザー単位課金（LINE公式アカウントの料金体系）に従います。配信通数は LINE 側契約に準拠。
- 署名検証に失敗したリクエストは 401 を返します（なりすまし対策）。
