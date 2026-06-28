import type { DistributionStrategy, LineAccountStatus } from "@/lib/data/types";

/** 振り分け候補（純粋ロジック用の最小情報） */
export interface Candidate {
  id: string;
  status: LineAccountStatus;
  /** 現在の登録者数 */
  count: number;
  /** 登録上限 */
  capacity: number;
  /** 重み（weighted用） */
  weight: number;
}

/**
 * 振り分け可能なLINEだけに絞る（§5/§8）。
 * - 停止中(paused)・凍結(suspended)は除外
 * - 登録上限に達したものは除外
 * - warning は受け付ける（稼働継続中の注意状態）
 */
export function eligibleCandidates<T extends Candidate>(candidates: T[]): T[] {
  return candidates.filter(
    (c) => (c.status === "active" || c.status === "warning") && c.count < c.capacity
  );
}

/**
 * 方式に従って1件を選択。割り当て不能なら null。
 * `rand` は注入可能（テスト用）。
 */
export function selectAccount<T extends Candidate>(
  candidates: T[],
  strategy: DistributionStrategy,
  rand: () => number = Math.random
): T | null {
  const pool = eligibleCandidates(candidates);
  if (pool.length === 0) return null;

  if (strategy === "even") {
    // 均等分散 = 現在もっとも登録が少ないLINEへ
    return pool.reduce((best, c) => (c.count < best.count ? c : best));
  }

  if (strategy === "weighted") {
    const total = pool.reduce((s, c) => s + Math.max(0, c.weight), 0);
    if (total <= 0) return pool[Math.floor(rand() * pool.length)]; // 全重み0なら均一
    let r = rand() * total;
    for (const c of pool) {
      r -= Math.max(0, c.weight);
      if (r <= 0) return c;
    }
    return pool[pool.length - 1];
  }

  // random = 均一ランダム
  return pool[Math.floor(rand() * pool.length)];
}
