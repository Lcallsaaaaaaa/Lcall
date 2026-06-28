import { getTemplate } from "@/config/rich-menu-templates";
import { getDataProvider } from "@/lib/data/provider";
import type { RichMenu } from "@/lib/data/types";

export interface RichMenuView extends RichMenu {
  accountName: string;
  tagName?: string;
  templateLabel: string;
  buttonCount: number;
}

/** リッチメニュー一覧（LINEアカウント名・タグ名・テンプレ名を結合）。新しい順。 */
export async function listRichMenus(): Promise<RichMenuView[]> {
  const db = getDataProvider();
  const [menus, accounts, tags] = await Promise.all([
    db.richMenus.list(),
    db.lineAccounts.list(),
    db.tags.list(),
  ]);
  return menus
    .map((m) => ({
      ...m,
      accountName: accounts.find((a) => a.id === m.lineAccountId)?.name ?? "（不明なアカウント）",
      tagName: m.targetTagId ? tags.find((t) => t.id === m.targetTagId)?.name : undefined,
      templateLabel: getTemplate(m.template)?.label ?? m.template,
      buttonCount: (m.areas ?? []).filter((a) => a.action !== "none").length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRichMenu(id: string): Promise<RichMenu | null> {
  return getDataProvider().richMenus.get(id);
}
