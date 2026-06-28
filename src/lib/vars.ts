/**
 * 本文中の差し込み変数を実値へ置換する。
 * 現在は {{name}} = 友だちの表示名（LINE名）のみ。定型文・シナリオ・チャット返信で共通利用。
 */
export const NAME_TOKEN = "{{name}}";

export function applyNameVars(text: string, name: string): string {
  return text.replace(/\{\{\s*name\s*\}\}/g, name);
}
