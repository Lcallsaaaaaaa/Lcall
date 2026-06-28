import { cn } from "@/lib/cn";

/** LCall ロゴ。マークと社名にブランドグラデーションを使用（アクセント限定）。 */
export function GradientLogo({
  size = "md",
  withWordmark = true,
  className,
}: {
  size?: "sm" | "md";
  withWordmark?: boolean;
  className?: string;
}) {
  const mark = size === "sm" ? "size-7" : "size-8";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 64 64" className={mark} role="img" aria-label="Lcall">
        <defs>
          <linearGradient id="lcall-ic" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f9a341" />
            <stop offset=".35" stopColor="#dd2a7b" />
            <stop offset=".7" stopColor="#8134af" />
            <stop offset="1" stopColor="#515bd4" />
          </linearGradient>
          <clipPath id="lcall-sq">
            <rect x="2" y="2" width="60" height="60" rx="17" />
          </clipPath>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#lcall-ic)" />
        <g clipPath="url(#lcall-sq)">
          <ellipse cx="20" cy="16" rx="34" ry="24" fill="#fff" opacity="0.16" />
        </g>
        <rect x="23" y="16" width="9" height="32" rx="4.5" fill="#fff" />
        <rect x="23" y="39" width="20" height="9" rx="4.5" fill="#fff" />
      </svg>
      {withWordmark && (
        <span className="gradient-text text-lg font-bold tracking-tight">Lcall</span>
      )}
    </div>
  );
}
