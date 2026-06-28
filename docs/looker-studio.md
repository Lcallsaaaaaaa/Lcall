# Looker Studio 連携手順

LCall の分析データを Looker Studio で可視化するための手順。LCall の本番データは
クライアントの Google アカウント上の **Google Sheets**（`LCALL_DATA_ADAPTER=sheets`）に保存される前提で、
Looker Studio はその Sheets を直結データソースとして参照する。

> 現状（フェーズ）はデータが `memory` アダプタ（ダミー）。Sheets アダプタ実装後にこの手順が有効になる。
> それまでは管理画面の **CSV出力**（`/api/export/[dataset]`）を Looker の「ファイルアップロード」データソースに使うことで暫定可視化できる。

## 1. データソース（推奨テーブル構造）

1スプレッドシート内に、エンティティごとに1シート＝1テーブルを置く（列名は1行目ヘッダ）。Looker で扱いやすい整形済みの推奨カラム:

| シート | 主なカラム |
| --- | --- |
| `friends` | id, lineUserId, displayName, lineAccountName, registeredAt(日付), lastClickAt, ltv(数値), status |
| `line_accounts` | id, name, status, capacity, registeredCount |
| `broadcasts` | id, title, type, status, sentCount, sentAt(日付) |
| `click_logs` | id, clickedAt(日時), friendId, broadcastId, redirectLinkId |
| `friend_tags` | id, friendId, tagName |
| `form_responses` | id, formTitle, friendName, createdAt(日付) |
| `survey_responses` | id, surveyTitle, friendName, q1..(値), createdAt |
| `invoices` | id, kind, amount(数値), status, issuedAt(日付) |

整形のポイント:
- 日付列は ISO 文字列ではなく `YYYY-MM-DD`（または日時 `YYYY-MM-DD HH:mm`）にして Looker の日付型に自動認識させる。
- ID 参照（lineAccountId 等）は **名前列も併記**（lineAccountName）すると Looker でそのまま軸に使える。
- 数値（ltv, amount, sentCount）は数値型にする（先頭に `¥` を付けない）。

## 2. 接続

1. Looker Studio で「作成」→「データソース」→ **Google スプレッドシート** コネクタ。
2. 対象スプレッドシート→対象シート（例 `friends`）を選択。「1行目をヘッダーとして使用」をオン。
3. フィールドの型（日付・数値・テキスト）を確認・調整して接続。
4. 複数テーブルを使う場合は、シートごとにデータソースを作成し、レポートで**データの統合（ブレンド）**を `friendId` 等で結合。

## 3. 代表的なレポート（管理画面の分析と対応）

- **登録月別推移**: `friends` を `registeredAt`（月）で集計 → 時系列グラフ
- **LINE別登録数**: `friends` を `lineAccountName` で集計 → 棒グラフ
- **クリック率**: `click_logs` 件数 ÷ `broadcasts` の `sentCount` 合計（スコアカード）
- **タグ別反応率**: `friend_tags` × `click_logs` をブレンドし、タグ別のクリック保有率
- **アクセス時間帯**: `click_logs` の `clickedAt` から時(hour)を抽出 → ヒストグラム
- **LTV / 売上**: `friends.ltv` 合計・平均、`invoices.amount`（paid）合計 → スコアカード
- **残存期間**: `friends` の登録経過月でバケット化

## 4. 自動更新

Sheets は LCall（Sheets アダプタ）が随時更新する。Looker Studio はデータソースの
データ更新間隔（最短15分）でリフレッシュされる。リアルタイム性が必要な指標は管理画面の `/analytics` を使う。

## 5. 暫定運用（Sheets アダプタ未実装時）

`/analytics` の CSV 出力ボタン、または `/api/export/{friends|clicks|broadcasts|form-responses|survey-responses}` で
CSV を取得し、Looker Studio の「ファイルのアップロード（CSV）」データソースに読み込む。
本番では Sheets 直結に置き換える。
