# 本番データ永続化（PostgreSQL / Supabase）

LCall の本番データは PostgreSQL に保存します。データ層は `Repository` 抽象（`src/lib/data`）越しなので、画面・API・queries は一切変更なしで切り替わります。

## アーキテクチャ

- アダプタ: `src/lib/data/postgres-adapter.ts`
- 全エンティティを **単一の汎用テーブル** に格納します:

  ```sql
  create table if not exists lcall_kv (
    entity text not null,
    id     text not null,
    data   jsonb not null,
    seq    bigserial,
    primary key (entity, id)
  );
  create index if not exists lcall_kv_entity_seq on lcall_kv (entity, seq);
  ```

  - `list()` は `seq` 昇順＝挿入順（memory/file アダプタの配列順と一致）。
  - `update()` は `data || patch`（jsonb 浅いマージ）で **行レベル原子更新**（read-modify-write を回避＝同時実行に強い）。
  - スキーマは初回アクセス時に `create table if not exists` で**自動作成**。手動マイグレーション不要。

## セットアップ手順

### 1. Postgres を用意（Supabase 推奨）

Supabase のプロジェクトを作成（無料枠可）。**Connection string（接続文字列）** を取得します。
Supabase ダッシュボード → Project Settings → Database → Connection string。

- サーバーレス（Vercel など）に載せる場合は **Transaction pooler**（ポート `6543`、ホストが `...pooler.supabase.com`）を使うこと。
- 常時起動サーバー（モデルB＝`next start`）なら direct（`5432`）でも可。

### 2. 環境変数

`.env.local`（本番は各ホストの環境変数）に **接続文字列だけ**を設定します。**チャットに貼らない**こと。

```
DATABASE_URL=postgresql://postgres.xxxx:【パスワード】@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

補助（任意）:

| 変数 | 既定 | 用途 |
|---|---|---|
| `LCALL_DATA_ADAPTER` | （自動） | `postgres` を明示。未設定でも `DATABASE_URL` があれば postgres を自動選択 |
| `PG_POOL_MAX` | `5` | 接続プール上限 |
| `PGSSL_DISABLE` | `false` | ローカル等で SSL 不要なとき `true` |

アダプタ選択の優先順位: 明示 `LCALL_DATA_ADAPTER`（memory以外） > `DATABASE_URL`（postgres）> Upstash 資格情報（upstash）> memory。

### 3. 接続チェック（任意）

接続文字列が通るか、スキーマ・CRUD・jsonb マージが効くかを単体確認:

```
node scripts/db-check.mjs
```

`DATABASE_URL` を読み、`lcall_kv` を自動作成して INSERT/SELECT(順序)/UPDATE(マージ)/DELETE を検証し、最後に後始末します（本番データには触れません＝専用の検証用 id を使用）。

### 4. シード投入

スキーマはアプリ起動で自動作成されます。初期データの投入は**明示的**に行います（本番DBへの誤投入防止）。

- 実クライアント（空で開始）: そのまま運用（投入不要）。
- 検証用にデモデータを入れる:

  ```
  # ログイン中(owner)ならブラウザから、または cron キーで
  curl -X POST "https://<APP>/api/admin/db-seed?key=<LCALL_WORKER_KEY>&mode=demo"
  ```

  - `mode=empty`（既定）: 何もしない（スキーマのみ）。
  - `mode=demo`: デモシードを投入。
  - **既にデータがあるエンティティはスキップ**するので、本番データを上書きしません。

### 5. 起動

`DATABASE_URL` を設定して `npm run build && npm run start`（または対応ホストへデプロイ）。
以降、友だち追加・チャット・配信・クリック計測などの書き込みはすべて Postgres に永続化されます（再起動・再デプロイでも消えません）。

## 補足

- 画像など大きなバイナリは引き続き R2/ローカルへ（`lib/storage.ts`）。DB にはURLのみ。
- バックアップ/PITR は Supabase 側の機能を利用。
- マルチテナント（モデルA）に進む場合は、`lcall_kv` に `tenant` 列を足して複合キー化する拡張が素直（別途）。
