import type { RichMenuSize } from "@/lib/data/types";

/**
 * リッチメニューのレイアウトテンプレート（テンプレート方式）。
 * 定番のグリッド（行×列）を提供し、各セルのピクセル境界を LINE の areas にそのまま使う。
 */
export interface RichMenuTemplate {
  id: string;
  size: RichMenuSize;
  label: string;
  rows: number;
  cols: number;
}

/** LINEのリッチメニュー画像キャンバス（幅は常に2500、高さがサイズで変わる）。 */
export const RICH_MENU_CANVAS: Record<RichMenuSize, { width: number; height: number }> = {
  large: { width: 2500, height: 1686 },
  compact: { width: 2500, height: 843 },
};

export const RICH_MENU_TEMPLATES: RichMenuTemplate[] = [
  { id: "large-2x3", size: "large", label: "大・6分割（2段×3列）", rows: 2, cols: 3 },
  { id: "large-1x3", size: "large", label: "大・3分割（横3列）", rows: 1, cols: 3 },
  { id: "large-2x2", size: "large", label: "大・4分割（2段×2列）", rows: 2, cols: 2 },
  { id: "large-1x2", size: "large", label: "大・2分割（横2列）", rows: 1, cols: 2 },
  { id: "large-2x1", size: "large", label: "大・2分割（縦2段）", rows: 2, cols: 1 },
  { id: "large-1x1", size: "large", label: "大・分割なし（1枚）", rows: 1, cols: 1 },
  { id: "compact-1x3", size: "compact", label: "小・3分割（横3列）", rows: 1, cols: 3 },
  { id: "compact-1x2", size: "compact", label: "小・2分割（横2列）", rows: 1, cols: 2 },
  { id: "compact-1x1", size: "compact", label: "小・分割なし（1枚）", rows: 1, cols: 1 },
];

export function getTemplate(id: string): RichMenuTemplate | undefined {
  return RICH_MENU_TEMPLATES.find((t) => t.id === id);
}

export function cellCount(templateId: string): number {
  const t = getTemplate(templateId);
  return t ? t.rows * t.cols : 0;
}

export interface CellBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** テンプレートの各セルのピクセル境界（行優先）。キャンバスを隙間なくタイル分割する。 */
export function templateCells(t: RichMenuTemplate): CellBounds[] {
  const { width: W, height: H } = RICH_MENU_CANVAS[t.size];
  const cells: CellBounds[] = [];
  for (let r = 0; r < t.rows; r++) {
    const y = Math.round((r * H) / t.rows);
    const y2 = Math.round(((r + 1) * H) / t.rows);
    for (let c = 0; c < t.cols; c++) {
      const x = Math.round((c * W) / t.cols);
      const x2 = Math.round(((c + 1) * W) / t.cols);
      cells.push({ x, y, width: x2 - x, height: y2 - y });
    }
  }
  return cells;
}

/** プレビュー用：各セルの位置をパーセンテージで返す（均等分割なのでグリッドと一致）。 */
export function templateCellsPercent(t: RichMenuTemplate): { left: number; top: number; width: number; height: number }[] {
  const out: { left: number; top: number; width: number; height: number }[] = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      out.push({
        left: (c / t.cols) * 100,
        top: (r / t.rows) * 100,
        width: (1 / t.cols) * 100,
        height: (1 / t.rows) * 100,
      });
    }
  }
  return out;
}
