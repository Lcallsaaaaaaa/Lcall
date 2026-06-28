import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { saveImageBytes } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * 画像アップロード（本実装）。要ログイン。
 * ローカル/Nodeホストでは public/uploads に保存し /uploads/<name> で配信。
 * 本番のサーバレス/スケール環境では saveUpload を R2 / S3 / Google Drive に差し替える。
 */
export async function POST(request: Request) {
  if (!(await getSession())) return new Response("unauthorized", { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(new URL("/media?error=nofile", request.url), 303);
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.redirect(new URL("/media?error=type", request.url), 303);
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.redirect(new URL("/media?error=size", request.url), 303);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await saveImageBytes(buf, file.type);

  const name = String(form.get("name") ?? "").trim() || file.name || "アップロード画像";
  await getDataProvider().mediaAssets.create({
    id: `med_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name,
    url,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/media");
  return NextResponse.redirect(new URL("/media", request.url), 303);
}
