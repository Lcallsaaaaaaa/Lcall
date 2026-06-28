"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * 送信中はクリックを無効化する submit ボタン（二重送信防止）。
 * 直近の親 <form> の送信状態を useFormStatus で監視する。
 */
export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(className, pending && "pointer-events-none opacity-60")}
    >
      {children}
    </button>
  );
}
