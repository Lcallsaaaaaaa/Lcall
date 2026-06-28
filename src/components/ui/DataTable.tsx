import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty?: ReactNode;
}

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/** Stripe調のテーブル。並べ替え等の機能は後続フェーズで拡張。 */
export function DataTable<T>({ columns, rows, getRowKey, empty }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-muted">
        {empty ?? "データがありません"}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted",
                  ALIGN[col.align ?? "left"]
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-b border-line last:border-0 hover:bg-surface-2/60"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-5 py-3 text-ink", ALIGN[col.align ?? "left"], col.className)}
                >
                  {col.render
                    ? col.render(row)
                    : ((row as Record<string, ReactNode>)[col.key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
