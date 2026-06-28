import type { DataProvider } from "./repository";

/**
 * Google Sheets アダプタの「差し込み口」。
 *
 * 後続フェーズで `googleapis` のサービスアカウント認証を使い、各エンティティを
 * 1シート=1テーブルとして読み書きする実装に置き換える。本番運用データは
 * クライアントの Google アカウント上の Sheets に保存する想定（§3, §12）。
 *
 * ここを実装し終えたら `LCALL_DATA_ADAPTER=sheets` で本番に切り替わる。
 * Repository インターフェースは共通なので、画面・API 側の変更は不要。
 */
export function createSheetsProvider(): DataProvider {
  throw new Error(
    "SheetsAdapter は未実装です。フェーズ0では LCALL_DATA_ADAPTER=memory（既定）で起動してください。"
  );
}
