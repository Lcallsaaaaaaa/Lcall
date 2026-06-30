import postgres from "postgres";
import type { DataProvider, Repository } from "./repository";
import type { EntityName, ID } from "./types";

/**
 * PostgreSQL アダプタ（本番）。
 *
 * 全エンティティを 1 つの汎用テーブル `lcall_kv(entity, id, data jsonb, seq)` に格納する。
 * Repository は汎用契約（list/get/create/update/remove）なので、列正規化せずとも
 * 実DBの durability・行レベル原子更新・同時実行に乗せられる（画面/queries 側は無変更）。
 *
 * - list は seq 昇順＝挿入順（memory/file アダプタの配列順と一致）。
 * - update は `data || patch` の jsonb マージ＝行レベルで原子的（read-modify-write を回避）。
 * - スキーマは初回アクセス時に `create table if not exists` で自動作成。
 *
 * 接続は `DATABASE_URL`（Supabase 等の Postgres 接続文字列）。サーバーレスでは
 * トランザクションプーラ（pgbouncer）互換のため prepared statement を無効化している。
 */

const TABLE = "lcall_kv";

type Sql = ReturnType<typeof postgres>;
/** porsager の sql.json が受け取る JSON 値型（エンティティは素のシリアライズ可能オブジェクト）。 */
type Json = Parameters<Sql["json"]>[0];

declare global {
  // dev のホットリロードや複数 import で接続プールが増殖しないよう保持。
  // マルチテナント（②：1アプリ＋クライアント別DB）に備え、接続URLごとにプールを保持する。
  // eslint-disable-next-line no-var
  var __lcallSqlPools: Map<string, Sql> | undefined;
  // eslint-disable-next-line no-var
  var __lcallSchemaReady: Map<string, Promise<void>> | undefined;
}

/** 接続プール（接続URLごとにプロセス内で共有）。url 未指定なら env `DATABASE_URL`。 */
function getSql(url?: string): Sql {
  const conn = (url ?? process.env.DATABASE_URL)?.trim();
  if (!conn) throw new Error("DATABASE_URL が未設定です（postgres アダプタ）");
  const pools = (globalThis.__lcallSqlPools ??= new Map());
  const existing = pools.get(conn);
  if (existing) return existing;
  const sql = postgres(conn, {
    ssl: process.env.PGSSL_DISABLE === "true" ? false : "require",
    prepare: false, // pgbouncer(transaction mode) 互換
    max: Number(process.env.PG_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 15,
  });
  pools.set(conn, sql);
  return sql;
}

/** スキーマ（テーブル＋索引）を接続ごとに一度だけ作成。 */
function ensureSchema(sql: Sql, conn: string): Promise<void> {
  const ready = (globalThis.__lcallSchemaReady ??= new Map());
  let p = ready.get(conn);
  if (!p) {
    p = (async () => {
      await sql`
        create table if not exists lcall_kv (
          entity text not null,
          id     text not null,
          data   jsonb not null,
          seq    bigserial,
          primary key (entity, id)
        )`;
      await sql`create index if not exists lcall_kv_entity_seq on lcall_kv (entity, seq)`;
    })().catch((e) => {
      ready.delete(conn); // 失敗したら次回再試行
      throw e;
    });
    ready.set(conn, p);
  }
  return p;
}

class PgRepository<T extends { id: ID }> implements Repository<T> {
  constructor(
    private readonly sql: Sql,
    private readonly conn: string,
    private readonly entity: EntityName
  ) {}

  async list(): Promise<T[]> {
    await ensureSchema(this.sql, this.conn);
    const rows = await this.sql<{ data: T }[]>`
      select data from lcall_kv where entity = ${this.entity} order by seq`;
    return rows.map((r) => r.data);
  }

  async get(id: ID): Promise<T | null> {
    await ensureSchema(this.sql, this.conn);
    const rows = await this.sql<{ data: T }[]>`
      select data from lcall_kv where entity = ${this.entity} and id = ${id}`;
    return rows.length ? rows[0].data : null;
  }

  async create(item: T): Promise<T> {
    await ensureSchema(this.sql, this.conn);
    await this.sql`
      insert into lcall_kv (entity, id, data)
      values (${this.entity}, ${item.id}, ${this.sql.json(item as unknown as Json)})
      on conflict (entity, id) do update set data = excluded.data`;
    return { ...item };
  }

  async update(id: ID, patch: Partial<T>): Promise<T | null> {
    await ensureSchema(this.sql, this.conn);
    // 既存 jsonb に patch を浅くマージ（{...existing, ...patch}）。id は常に維持。
    const rows = await this.sql<{ data: T }[]>`
      update lcall_kv
      set data = (data || ${this.sql.json(patch as unknown as Json)}::jsonb) || ${this.sql.json({ id } as unknown as Json)}::jsonb
      where entity = ${this.entity} and id = ${id}
      returning data`;
    return rows.length ? rows[0].data : null;
  }

  async remove(id: ID): Promise<boolean> {
    await ensureSchema(this.sql, this.conn);
    const rows = await this.sql`
      delete from lcall_kv where entity = ${this.entity} and id = ${id} returning id`;
    return rows.count > 0;
  }
}

/**
 * PostgreSQL 版 DataProvider を構築。
 * @param entityNames 取り扱うエンティティ名（通常は seed のキー）
 * @param connectionUrl テナント別DBの接続URL（未指定は env `DATABASE_URL`）。
 */
export function createPostgresProvider(entityNames: EntityName[], connectionUrl?: string): DataProvider {
  const conn = (connectionUrl ?? process.env.DATABASE_URL ?? "").trim();
  const sql = getSql(conn);
  const provider = {} as Record<EntityName, unknown>;
  for (const name of entityNames) provider[name] = new PgRepository(sql, conn, name);
  return provider as DataProvider;
}
