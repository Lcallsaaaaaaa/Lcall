import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BroadcastStatus, Friend, LineAccountStatus } from "@/lib/data/types";

export type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "info";

const TONE: Record<BadgeTone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-neutral",
  info: "bg-[#eef2ff] text-[#515bd4]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const LINE_STATUS: Record<LineAccountStatus, { tone: BadgeTone; label: string }> = {
  active: { tone: "ok", label: "稼働中" },
  paused: { tone: "neutral", label: "停止中" },
  warning: { tone: "warn", label: "警告" },
  suspended: { tone: "danger", label: "凍結" },
};

/** LINEアカウント状態のバッジ（§5 ステータス管理）。 */
export function StatusBadge({ status }: { status: LineAccountStatus }) {
  const { tone, label } = LINE_STATUS[status];
  return (
    <Badge tone={tone}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "ok" && "bg-ok",
          tone === "warn" && "bg-warn",
          tone === "danger" && "bg-danger",
          tone === "neutral" && "bg-neutral"
        )}
      />
      {label}
    </Badge>
  );
}

const FRIEND_STATUS: Record<Friend["status"], { tone: BadgeTone; label: string }> = {
  active: { tone: "ok", label: "有効" },
  blocked: { tone: "danger", label: "ブロック" },
  unsubscribed: { tone: "neutral", label: "配信停止" },
};

/** 顧客（友だち）状態のバッジ（§5 顧客管理）。 */
export function FriendStatusBadge({ status }: { status: Friend["status"] }) {
  const { tone, label } = FRIEND_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const BROADCAST_STATUS: Record<BroadcastStatus, { tone: BadgeTone; label: string }> = {
  draft: { tone: "neutral", label: "下書き" },
  scheduled: { tone: "info", label: "予約" },
  sent: { tone: "ok", label: "送信済み" },
  failed: { tone: "danger", label: "失敗" },
};

/** 配信状態のバッジ（§5 配信管理）。 */
export function BroadcastStatusBadge({ status }: { status: BroadcastStatus }) {
  const { tone, label } = BROADCAST_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
