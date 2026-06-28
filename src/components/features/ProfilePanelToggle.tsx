"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * チャット受信箱の右「顧客プロフィール欄」を開閉するトグル。
 * 畳むとメッセージ表示エリアが約288px広がる。`<html>` に class を付け、
 * globals.css の `html.chat-hide-profile #chat-profile { display:none }` で隠す。
 * プロフィール欄が存在する lg 以上でのみ表示（モバイルは元々非表示）。
 */
export function ProfilePanelToggle() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("chat-hide-profile", hidden);
    return () => root.classList.remove("chat-hide-profile");
  }, [hidden]);

  return (
    <button
      type="button"
      onClick={() => setHidden((h) => !h)}
      title={hidden ? "顧客情報を表示" : "顧客情報を隠してメッセージを広げる"}
      className="hidden items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-ink lg:inline-flex"
    >
      {hidden ? <PanelRightOpen className="size-3.5" /> : <PanelRightClose className="size-3.5" />}
      {hidden ? "顧客情報" : "広く表示"}
    </button>
  );
}
