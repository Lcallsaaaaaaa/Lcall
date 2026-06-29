# 広告コンバージョン計測（Meta / Google）

広告（Meta・Google）から友だち追加までを計測する仕組み。クライアント（出稿アカウント）ごとに環境変数で設定する。

## 導線と計測点

```
広告クリック
  → /j?ad=CODE   （タグ付き着地ページ：Meta Pixel / Google gtag が PageView 発火＝①リマケ用）
     ※媒体が gclid / fbclid を自動付与
  → /api/distribute?ad=CODE&gclid=…&fbclid=…  （登録ログに gclid/fbclid/IP/UA を保存）
  → LINE 友だち追加URL（LINEアプリ内で追加＝Web外）
  → follow Webhook 受信
     → 直近60分の登録ログを突き合わせて友だちに gclid/fbclid/広告コードを引き継ぎ
     → ②サーバー側コンバージョン送信（Meta Conversions API / GA4 Measurement Protocol）
```

- **①ブラウザタグ**: `/j` で Pixel/gtag が動く（リマーケティング・PageView）。タグ不要なら遷移先を `/api/distribute?ad=CODE` に直接してもよい（その場合①は無し・②のみ）。
- **②サーバー側コンバージョン**: 実際の「友だち追加」はLINEアプリ内（Web外）で起きるためブラウザPixelでは捉えられない。follow Webhook 受信時にサーバーから送る（Meta CAPI / GA4 MP）。
- **マッチング**: クリック（distribute）と follow は別リクエストのため、直近60分・同一LINEアカウント優先で突き合わせる推定方式（既存の流入元推定と同じ）。1クリック=1友だちで紐づけ、重複送信を防ぐ。厳密な1:1突き合わせが必要ならLINEログイン(LIFF)導入が将来の拡張。

## 環境変数

| 変数 | 用途 |
|---|---|
| `META_PIXEL_ID` | Meta Pixel ID（①ブラウザPixel＋②CAPIに使用） |
| `META_CAPI_TOKEN` | Meta Conversions API アクセストークン（②） |
| `META_TEST_EVENT_CODE` | （任意）イベントマネージャのテスト時のみ |
| `GA4_MEASUREMENT_ID` | GA4 測定ID（例 `G-XXXX`。①gtag＋②MP） |
| `GA4_API_SECRET` | GA4 Measurement Protocol APIシークレット（②） |
| `GOOGLE_ADS_CONVERSION_ID` / `_LABEL` | （任意）gtagでのGoogle広告CVタグ用 |

未設定の媒体は自動でスキップ（コードは常に安全に通る）。

## 送信イベント
- Meta: `CompleteRegistration`（友だち登録完了）。`fbc`（fbclidから生成）・`client_ip_address`・`client_user_agent`・`fbp` をマッチに使用。
- Google: GA4 `generate_lead`。GA4をGoogle広告に連携し `generate_lead` をコンバージョンとしてインポートすると広告側で計測できる。

## 確認
- 送信結果は `conversionLogs`（platform / event / status=sent|failed|skipped / detail）に記録。
- Meta はイベントマネージャの「テストイベント」（`META_TEST_EVENT_CODE`）で着弾確認できる。
- GA4 は DebugView / リアルタイムで `generate_lead` を確認。

## 注意
- 着弾には各媒体の正しいID/トークンが必須。設定が無い／誤っていると `conversionLogs` が `skipped`／`failed` になる。
- gclid を使うには Google 広告で「自動タグ設定」を有効化（既定で有効）。
