"use client";

import { useFormStatus } from "react-dom";

export interface Slot {
  startISO: string;
  label: string;
  available: boolean;
}

/**
 * 予約の時間枠ボタン。送信中(pending)は全ボタンを無効化して二重送信を防ぐ
 * （連打で「満枠」になる問題の対策）。予約フォーム・日時変更フォームで共用。
 */
export function SlotButtons({ slots }: { slots: Slot[] }) {
  const { pending } = useFormStatus();
  if (slots.length === 0) {
    return <p className="text-sm text-muted">この日の空き枠がありません。</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((s) => {
        const usable = s.available && !pending;
        return (
          <button
            key={s.startISO}
            type="submit"
            name="startISO"
            value={s.startISO}
            disabled={!usable}
            aria-busy={pending}
            className={
              usable
                ? "rounded-lg border border-brand/40 bg-brand/5 px-2 py-2 text-sm font-medium text-ink transition hover:bg-brand hover:text-white"
                : "cursor-not-allowed rounded-lg border border-line px-2 py-2 text-sm text-faint"
            }
          >
            {s.label}
          </button>
        );
      })}
      {pending && (
        <p className="col-span-full mt-1 text-center text-xs text-muted">送信中です。そのままお待ちください…</p>
      )}
    </div>
  );
}
