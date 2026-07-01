"use client";

import { useEffect, useState } from "react";

/** 発行完了後、一定秒後にクライアントのログイン画面へ自動遷移する（残り秒数を表示）。 */
export function AutoRedirect({ url, seconds = 5 }: { url: string; seconds?: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!url) return;
    const iv = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    const t = setTimeout(() => {
      window.location.href = url;
    }, seconds * 1000);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
  }, [url, seconds]);
  return <p className="mt-3 text-center text-xs text-muted">{left}秒後にログイン画面へ移動します…</p>;
}
