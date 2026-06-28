import type { DataProvider, Repository } from "./repository";
import type { EntityMap, EntityName } from "./types";

type Seed = { [K in EntityName]: EntityMap[K][] };

/**
 * シードをデータプロバイダへ投入する。
 * **既にデータがあるエンティティはスキップ**（本番DBの誤上書きを防止）。
 * postgres など永続アダプタへの初期投入に使う。戻り値は各エンティティの投入件数。
 */
export async function seedProvider(
  provider: DataProvider,
  seed: Seed
): Promise<{ inserted: Record<string, number>; skipped: string[] }> {
  const inserted: Record<string, number> = {};
  const skipped: string[] = [];
  for (const name of Object.keys(seed) as EntityName[]) {
    const repo = provider[name] as Repository<{ id: string }>;
    const existing = await repo.list();
    if (existing.length > 0) {
      skipped.push(name);
      continue;
    }
    let n = 0;
    for (const item of seed[name] as { id: string }[]) {
      await repo.create(item);
      n++;
    }
    if (n > 0) inserted[name] = n;
  }
  return { inserted, skipped };
}
