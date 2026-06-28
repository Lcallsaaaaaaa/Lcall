"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

/**
 * 「ユーザー名を挿入」ボタン付きテキストエリア。
 * クリックでカーソル位置に {{name}} を差し込む（送信時に友だちの表示名へ置換される）。
 * 定型文・シナリオの本文入力で使用。
 */
export function VarTextarea({
  id,
  name,
  defaultValue,
  placeholder,
  required,
  rows = 3,
  className,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertToken() {
    const ta = ref.current;
    if (!ta) return;
    const token = "{{name}}";
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
    ta.focus();
    const pos = start + token.length;
    ta.setSelectionRange(pos, pos);
  }

  return (
    <div className="space-y-1">
      <textarea
        ref={ref}
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className={cn(CONTROL, "min-h-20 resize-y", className)}
      />
      <button
        type="button"
        onClick={insertToken}
        className="text-xs font-medium text-brand transition hover:underline"
      >
        ＋ ユーザー名を挿入（{"{{name}}"}）
      </button>
    </div>
  );
}
