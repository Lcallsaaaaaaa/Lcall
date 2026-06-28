import fs from "node:fs";
import path from "node:path";
import type { DataProvider, Repository } from "./repository";
import type { EntityMap, EntityName, ID } from "./types";

/**
 * ファイル永続化アダプタ（JSON・依存ゼロ）。
 * 1インスタンス＝1ファイル（env `LCALL_DATA_FILE`）。再起動・再デプロイでも消えない。
 * モデルB（1クライアント＝1インスタンス）向け。読み取りはメモリ、書込み毎に原子的保存。
 */
type Seed = { [K in EntityName]: EntityMap[K][] };
type Store = Record<EntityName, { id: ID }[]>;

function persist(filePath: string, store: Store): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store), "utf8");
  fs.renameSync(tmp, filePath); // 原子的置換（書込み途中の破損を防ぐ）
}

function loadOrInit(filePath: string, seed: Seed): Store {
  const keys = Object.keys(seed) as EntityName[];
  const store = {} as Store;
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
      // 既存データを採用。後から増えたエンティティ（新キー）は空配列で補完。
      for (const k of keys) {
        const arr = parsed[k];
        store[k] = Array.isArray(arr) ? (arr as { id: ID }[]) : [];
      }
      return store;
    }
  } catch (e) {
    console.error(`[data] ${filePath} の読込に失敗。シードで初期化します:`, e);
  }
  for (const k of keys) store[k] = (seed[k] as { id: ID }[]).map((x) => ({ ...x }));
  persist(filePath, store);
  return store;
}

class FileRepository<T extends { id: ID }> implements Repository<T> {
  // items は store の配列参照そのもの（in-place 変更で store に反映 → save で永続化）
  constructor(
    private readonly items: T[],
    private readonly save: () => void
  ) {}

  async list(): Promise<T[]> {
    return this.items.map((x) => ({ ...x }));
  }
  async get(id: ID): Promise<T | null> {
    const found = this.items.find((x) => x.id === id);
    return found ? { ...found } : null;
  }
  async create(item: T): Promise<T> {
    this.items.push({ ...item });
    this.save();
    return { ...item };
  }
  async update(id: ID, patch: Partial<T>): Promise<T | null> {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    this.items[idx] = { ...this.items[idx], ...patch, id };
    this.save();
    return { ...this.items[idx] };
  }
  async remove(id: ID): Promise<boolean> {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this.save();
    return true;
  }
}

/** シード＋ファイルパスから永続化 DataProvider を組み立てる。 */
export function createFileProvider(seed: Seed, filePath: string): DataProvider {
  const store = loadOrInit(filePath, seed);
  const save = () => persist(filePath, store);
  const provider = {} as Record<EntityName, unknown>;
  (Object.keys(store) as EntityName[]).forEach((name) => {
    provider[name] = new FileRepository(store[name], save);
  });
  return provider as DataProvider;
}
