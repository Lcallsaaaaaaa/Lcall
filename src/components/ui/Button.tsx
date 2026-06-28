import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "gradient" | "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition select-none disabled:opacity-50 disabled:pointer-events-none";

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

const VARIANTS: Record<ButtonVariant, string> = {
  // CTA = ブランドグラデーション（アクセント限定使用）
  gradient: "gradient-bg text-white cta-shadow hover:brightness-[1.05]",
  solid: "bg-ink text-white hover:bg-ink/90",
  outline: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
};

/** Link/a にも同じ見た目を適用するためのクラス生成ヘルパー。 */
export function buttonClasses(
  variant: ButtonVariant = "outline",
  size: ButtonSize = "md",
  className?: string
): string {
  return cn(BASE, SIZES[size], VARIANTS[variant], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "outline",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
