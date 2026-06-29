import type { DataProvider } from "@/lib/data/repository";
import type { Friend } from "@/lib/data/types";

/**
 * 電話番号を比較用に正規化（数字のみ。先頭の国番号 81 → 0 に変換）。
 * 例: "090-1234-5678" → "09012345678" / "+81 90-1234-5678" → "09012345678"
 */
export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  let d = String(raw).replace(/\D+/g, "");
  if (d.startsWith("81") && !d.startsWith("810")) d = "0" + d.slice(2);
  return d;
}

/**
 * 予約者の電話番号から既存の友だちを推定する（簡易・自動マッチ）。
 * Friend 自体に電話番号は無いため、過去に friendId が紐づいた
 *   ① 予約（Reservation.phone）
 *   ② 申込フォーム回答（type="tel" 項目の値）
 * の電話から逆引きする。
 *
 * 誤紐づけ防止のため、同一電話で複数の友だちが該当する場合は null を返す。
 * lineAccountId を渡すと、その公式アカウントに属する友だちに限定する（共通ページなら未指定）。
 */
export async function matchFriendByPhone(
  db: DataProvider,
  phone: string | undefined,
  lineAccountId?: string
): Promise<Friend | null> {
  const target = normalizePhone(phone);
  if (target.length < 10) return null; // 桁不足の番号は誤マッチを避けて対象外

  const candidates = new Set<string>(); // 一致した friendId

  // ① 過去の予約（friendId 付き・電話一致）
  for (const r of await db.reservations.list()) {
    if (r.friendId && normalizePhone(r.phone) === target) candidates.add(r.friendId);
  }

  // ② フォーム回答（friendId 付き・tel 項目の値が一致）
  const responses = (await db.formResponses.list()).filter((r) => r.friendId);
  if (responses.length) {
    const telFieldsByForm = new Map<string, string[]>();
    for (const f of await db.formFields.list()) {
      if (f.type !== "tel") continue;
      const arr = telFieldsByForm.get(f.formId) ?? [];
      arr.push(f.id);
      telFieldsByForm.set(f.formId, arr);
    }
    for (const res of responses) {
      const ids = telFieldsByForm.get(res.formId);
      if (!ids) continue;
      for (const fid of ids) {
        if (res.friendId && normalizePhone(res.values?.[fid]) === target) candidates.add(res.friendId);
      }
    }
  }

  if (candidates.size !== 1) return null; // 0件 or 複数 は紐づけない
  const friend = await db.friends.get([...candidates][0]);
  if (!friend) return null;
  if (lineAccountId && friend.lineAccountId !== lineAccountId) return null;
  return friend;
}
