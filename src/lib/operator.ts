import crypto from "node:crypto";
import type { DataProvider } from "./data/repository";

/**
 * 運営コンソール（コントロールプレーン）↔ クライアントインスタンス間の連携。
 *
 * 各クライアントインスタンスは `LCALL_OPERATOR_KEY`（クライアント毎にユニーク）を持ち、
 * 運営コンソールはそのキーを `x-lcall-operator-key` ヘッダに付けて `/api/operator/*` を叩く。
 * 未設定インスタンスは運営APIを常に拒否（fail-closed）。
 */

const SUSPEND_KEY = "operations_suspended";

/** このデプロイが運営コンソール（コントロールプレーン）か。 */
export function isControlPlane(): boolean {
  return process.env.LCALL_CONTROL_PLANE === "true";
}

/** このインスタンスの運営API共有シークレット（未設定＝運営API無効）。 */
export function operatorKey(): string {
  return process.env.LCALL_OPERATOR_KEY?.trim() ?? "";
}

/** 運営APIキーの検証（定数時間比較）。 */
export function verifyOperatorKey(request: Request): boolean {
  const key = operatorKey();
  if (!key) return false;
  const got = request.headers.get("x-lcall-operator-key") ?? "";
  if (got.length !== key.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(key));
  } catch {
    return false;
  }
}

/** 運営により一時停止中か（SystemSetting `operations_suspended`）。配信実行などが参照。 */
export async function isOperationsSuspended(db: DataProvider): Promise<boolean> {
  const s = (await db.systemSettings.list()).find((x) => x.key === SUSPEND_KEY);
  return s?.value === "true";
}

/** 一時停止フラグを設定（運営の遠隔操作）。 */
export async function setOperationsSuspended(db: DataProvider, value: boolean): Promise<void> {
  const all = await db.systemSettings.list();
  const ex = all.find((x) => x.key === SUSPEND_KEY);
  if (ex) await db.systemSettings.update(ex.id, { value: value ? "true" : "false" });
  else
    await db.systemSettings.create({
      id: `set_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      key: SUSPEND_KEY,
      value: value ? "true" : "false",
    });
}
