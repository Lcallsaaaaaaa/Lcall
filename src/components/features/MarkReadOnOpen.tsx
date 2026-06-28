"use client";

import { useEffect, useRef } from "react";
import { markRead } from "@/features/chat/actions";

/**
 * スレッドを開いた（表示した）ときに自動で既読化する。
 * 未読がある場合のみ markRead を発火。同一スレッドで二重発火しないよう ref でガード。
 */
export function MarkReadOnOpen({ friendId, hasUnread }: { friendId: string; hasUnread: boolean }) {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (hasUnread && handled.current !== friendId) {
      handled.current = friendId;
      void markRead(friendId);
    }
  }, [friendId, hasUnread]);
  return null;
}
