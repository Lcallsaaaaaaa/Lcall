import type { EntityMap, EntityName, ID } from "./types";

/**
 * 全エンティティ共通の最小リポジトリ契約。
 * アダプタ（Memory / Sheets / 将来DB）はこれを実装する。
 */
export interface Repository<T extends { id: ID }> {
  list(): Promise<T[]>;
  get(id: ID): Promise<T | null>;
  create(item: T): Promise<T>;
  update(id: ID, patch: Partial<T>): Promise<T | null>;
  remove(id: ID): Promise<boolean>;
}

/**
 * アプリ全体が依存するデータアクセス窓口。
 * 画面・API はここ越しにしかストレージへ触らない（§12 DB移行のしやすさ）。
 */
export type DataProvider = {
  [K in EntityName]: Repository<EntityMap[K]>;
};
