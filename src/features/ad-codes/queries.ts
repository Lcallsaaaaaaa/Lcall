import { getDataProvider } from "@/lib/data/provider";
import type { AdCode } from "@/lib/data/types";

export interface AdCodeRow extends AdCode {
  /** この広告コード経由で登録された友だち数 */
  friendCount: number;
}

export async function listAdCodes(): Promise<AdCodeRow[]> {
  const db = getDataProvider();
  const [codes, friends] = await Promise.all([db.adCodes.list(), db.friends.list()]);
  const count = new Map<string, number>();
  for (const f of friends) if (f.sourceCode) count.set(f.sourceCode, (count.get(f.sourceCode) ?? 0) + 1);
  return codes
    .map((c) => ({ ...c, friendCount: count.get(c.code) ?? 0 }))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
