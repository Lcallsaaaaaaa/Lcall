/**
 * 本文中の差し込み変数を実値へ置換する。定型文・シナリオ・チャット返信で共通利用。
 * - {{name}}   = 友だちの表示名（LINE名）
 * - {friendId} = 友だちID（フォーム/アンケートURLの ?u= 用。回答者をLINE名で記録するため）
 */
export const NAME_TOKEN = "{{name}}";

export function applyNameVars(text: string, name: string): string {
  return text.replace(/\{\{\s*name\s*\}\}/g, name);
}

/**
 * {{name}} と {friendId} の両方を置換する（配信本文向け）。
 * 本文に `https://…/f/フォームID?u={friendId}` を入れて配信すると、回答が
 * その友だちに紐づき、回答一覧・顧客詳細にLINE名で表示される。
 */
export function applyFriendVars(text: string, friend: { displayName: string; id: string }): string {
  return applyNameVars(text, friend.displayName).replace(/\{friendId\}/g, friend.id);
}
