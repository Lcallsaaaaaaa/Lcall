import { getDataProvider } from "@/lib/data/provider";

export const runtime = "nodejs";

/**
 * アプリ内蔵の画像配信。R2 未設定時、受信画像/アップロード画像/カルーセル画像は
 * DB（storedImages）に保管され、ここで配信する（Render等でローカルファイルが
 * 配信/永続化できない問題を回避）。公開GET（LINEのカルーセル画像取得も想定）。
 *   GET /api/img/{id}
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const img = await getDataProvider().storedImages.get(id);
  if (!img) return new Response("not found", { status: 404 });

  return new Response(Buffer.from(img.data, "base64"), {
    headers: {
      "content-type": img.contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
