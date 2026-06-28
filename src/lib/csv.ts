/** CSV生成ユーティリティ（§5 CSV出力）。Excel向けに BOM + CRLF。 */

type Cell = string | number | null | undefined;

function escapeCell(v: Cell): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","));
  return "﻿" + lines.join("\r\n");
}

/** route handler から返す CSV レスポンス（ダウンロード）。filename は ASCII 推奨。 */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
