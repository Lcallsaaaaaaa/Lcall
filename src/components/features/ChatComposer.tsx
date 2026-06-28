"use client";

import { Send } from "lucide-react";
import { useRef } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";

interface TemplateLite {
  id: string;
  title: string;
  text: string;
}

/**
 * チャット返信の入力欄（クライアント）。
 * - 定型文を選ぶと返信欄に挿入され、編集してから送信できる（{{name}} は友だち名に置換）
 * - Ctrl+Enter（Cmd+Enter）で送信、送信ボタンでも送信
 * 送信は server action（action prop）。React 19 が送信後にフォームを自動リセットする。
 */
export function ChatComposer({
  action,
  templates,
  friendName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  templates: TemplateLite[];
  friendName: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 入力量に応じて高さを自動調整（最大 ~10行、それ以上はスクロール）
  function autoGrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }

  function applyName(text: string): string {
    return text.replace(/\{\{\s*name\s*\}\}/g, friendName);
  }

  function insertTemplate(text: string) {
    const ta = taRef.current;
    if (!ta) return;
    const value = applyName(text);
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    ta.value = ta.value.slice(0, start) + value + ta.value.slice(end);
    ta.focus();
    const pos = start + value.length;
    ta.setSelectionRange(pos, pos);
    autoGrow();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      // 送信中（SubmitButton が disabled）は二重送信しない
      if (formRef.current?.querySelector("button[type='submit']:disabled")) return;
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="space-y-2">
      <form ref={formRef} action={action} onReset={() => requestAnimationFrame(autoGrow)} className="flex items-end gap-2">
        <textarea
          ref={taRef}
          name="text"
          rows={1}
          onInput={autoGrow}
          onKeyDown={onKeyDown}
          placeholder="返信を入力…（改行可。Ctrl+Enter で送信）"
          className="max-h-60 min-h-10 flex-1 resize-none overflow-y-auto rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <SubmitButton className="gradient-bg flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-white">
          <Send className="size-4" />
          送信
        </SubmitButton>
      </form>
      {templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) insertTemplate(t.text);
              e.currentTarget.value = "";
            }}
            className="h-9 w-48 appearance-none rounded-lg border border-line-strong bg-surface px-3 pr-8 text-xs text-ink outline-none focus:border-brand"
          >
            <option value="">定型文を挿入…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <span className="text-xs text-faint">選ぶと返信欄に入ります（編集して送信できます）</span>
        </div>
      )}
    </div>
  );
}
