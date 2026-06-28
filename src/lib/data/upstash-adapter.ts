import type { DataProvider, Repository } from "./repository";
import type { EntityMap, EntityName, ID } from "./types";

/**
 * Upstash Redis（REST）アダプタ。
 * DB全体を1つのJSONブロブとして単一キーに保存し、リクエストごとに読み書きする。
 * Vercel等のサーバーレスでも全インスタンスが同じデータを共有できる（メモリadapterの
 * 「作成直後に別インスタンスで404」問題を解消）。デモ・小規模向け（単一ブロブ・last-write-wins）。
 */
type Seed = { [K in EntityName]: EntityMap[K][] };

const KEY = process.env.LCALL_KV_KEY?.trim() || "lcall:db";
const CACHE_TTL_MS = 800; // 同一リクエスト内の重複GETをまとめる程度の短いTTL

let cache: { db: Seed; at: number } | null = null;

async function redis(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("UPSTASH_REDIS_REST_URL / _TOKEN が未設定です");
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text().catch(() => "")}`);
  return ((await res.json()) as { result: unknown }).result;
}

async function persist(db: Seed): Promise<void> {
  await redis(["SET", KEY, JSON.stringify(db)]);
  cache = { db, at: Date.now() };
}

async function loadDb(seedFactory: () => Seed): Promise<Seed> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.db;
  const raw = (await redis(["GET", KEY])) as string | null;
  let db: Seed;
  if (raw) {
    try {
      db = JSON.parse(raw) as Seed;
    } catch {
      db = seedFactory();
      await persist(db);
    }
  } else {
    // 初回: 初期データを投入
    db = seedFactory();
    await persist(db);
  }
  cache = { db, at: Date.now() };
  return db;
}

class KvRepository<T extends { id: ID }> implements Repository<T> {
  constructor(
    private readonly name: EntityName,
    private readonly seedFactory: () => Seed
  ) {}

  private async arr(): Promise<{ db: Seed; items: T[] }> {
    const db = await loadDb(this.seedFactory);
    // db[name] と同一参照。push/代入で in-place に変更すると db に反映される
    return { db, items: db[this.name] as unknown as T[] };
  }

  async list(): Promise<T[]> {
    const { items } = await this.arr();
    return items.map((x) => ({ ...x }));
  }

  async get(id: ID): Promise<T | null> {
    const { items } = await this.arr();
    const found = items.find((x) => x.id === id);
    return found ? { ...found } : null;
  }

  async create(item: T): Promise<T> {
    const { db, items } = await this.arr();
    items.push({ ...item }); // 同一参照を変更 → db に反映
    await persist(db);
    return { ...item };
  }

  async update(id: ID, patch: Partial<T>): Promise<T | null> {
    const { db, items } = await this.arr();
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...patch, id };
    await persist(db);
    return { ...items[idx] };
  }

  async remove(id: ID): Promise<boolean> {
    const { db, items } = await this.arr();
    const next = items.filter((x) => x.id !== id);
    if (next.length === items.length) return false;
    (db as Record<string, unknown>)[this.name] = next;
    await persist(db);
    return true;
  }
}

/** Upstash Redis 版 DataProvider を構築。データは各メソッドでKVから読み書き（プロバイダ自体は無状態）。 */
export function createUpstashProvider(seedFactory: () => Seed): DataProvider {
  const provider = {} as Record<EntityName, unknown>;
  for (const name of Object.keys(seedFactory()) as EntityName[]) {
    provider[name] = new KvRepository(name, seedFactory);
  }
  return provider as DataProvider;
}
