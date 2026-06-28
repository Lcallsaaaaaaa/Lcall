import type { DataProvider, Repository } from "./repository";
import type { EntityMap, EntityName, ID } from "./types";

/** 配列ベースのインメモリ実装。ローカル開発・デモ用。 */
class MemoryRepository<T extends { id: ID }> implements Repository<T> {
  private items: T[];

  constructor(seed: T[]) {
    // 防御的コピー（呼び出し側のミューテーションを遮断）
    this.items = seed.map((x) => ({ ...x }));
  }

  async list(): Promise<T[]> {
    return this.items.map((x) => ({ ...x }));
  }

  async get(id: ID): Promise<T | null> {
    const found = this.items.find((x) => x.id === id);
    return found ? { ...found } : null;
  }

  async create(item: T): Promise<T> {
    this.items.push({ ...item });
    return { ...item };
  }

  async update(id: ID, patch: Partial<T>): Promise<T | null> {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    this.items[idx] = { ...this.items[idx], ...patch, id };
    return { ...this.items[idx] };
  }

  async remove(id: ID): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((x) => x.id !== id);
    return this.items.length < before;
  }
}

/** シード（全エンティティの初期配列）から DataProvider を組み立てる。 */
export function createMemoryProvider(seed: {
  [K in EntityName]: EntityMap[K][];
}): DataProvider {
  const provider = {} as Record<EntityName, unknown>;
  (Object.keys(seed) as EntityName[]).forEach((name) => {
    provider[name] = new MemoryRepository(seed[name] as { id: ID }[]);
  });
  return provider as DataProvider;
}
