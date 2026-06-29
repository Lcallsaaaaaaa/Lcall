"use client";

import { useRef, useState } from "react";

/**
 * リッチメニュー画像のファイル入力。LINEの制約（1MB以下・幅2500pxまで）に合わせ、
 * 選択時にブラウザ側で自動リサイズ＆JPEG圧縮してから送信する（大きな画像でもエラーにならない）。
 */
async function compressImage(file: File, maxDim = 2500, maxBytes = 1_000_000): Promise<File> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  let scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  let quality = 0.92;
  let last: File | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff"; // PNGの透過は白背景に
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) break;
    last = new File([blob], "richmenu.jpg", { type: "image/jpeg" });
    if (blob.size <= maxBytes) return last;
    if (quality > 0.6) quality -= 0.12;
    else scale *= 0.85;
  }
  if (last) return last;
  return file; // 圧縮できなければ元ファイル（サーバ側で再チェック）
}

export function RichMenuImageInput() {
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size <= 1_000_000 && f.type === "image/jpeg") {
      setNote(`選択済み（${Math.round(f.size / 1024)}KB）`);
      return;
    }
    setBusy(true);
    setNote("画像を最適化中…");
    try {
      const out = await compressImage(f);
      const dt = new DataTransfer();
      dt.items.add(out);
      if (ref.current) ref.current.files = dt.files;
      setNote(`最適化しました（${Math.round(out.size / 1024)}KB）`);
    } catch {
      setNote("最適化に失敗しました。別の画像でお試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={ref}
        id="image"
        name="image"
        type="file"
        accept="image/png,image/jpeg"
        onChange={onChange}
        required
        className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
      />
      {note && <p className="mt-1 text-xs text-muted">{busy ? "⏳ " : ""}{note}</p>}
    </div>
  );
}
