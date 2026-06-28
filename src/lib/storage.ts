import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

function guessImageType(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

/**
 * 保存済み画像URLからバイト列を読み戻す（リッチメニューを実LINEへアップロードする際に使用）。
 * https は fetch、ローカル /uploads/.. は public 配下から読む。
 */
export async function readImageBytes(
  url: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, contentType: res.headers.get("content-type") || guessImageType(url) };
    }
    const rel = url.replace(/^\//, "");
    const buffer = await readFile(path.join(process.cwd(), "public", rel));
    return { buffer, contentType: guessImageType(url) };
  } catch {
    return null;
  }
}

/**
 * 画像バイト列を保存して公開URLを返す（アップロード・LINE受信画像の保管で共用）。
 * R2（S3互換）の環境変数が揃っていれば R2 へ、無ければローカル public/uploads へ保存。
 */
export async function saveImageBytes(buf: Buffer, contentType: string): Promise<string> {
  const ext = (contentType.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;

  if (accountId && accessKeyId && secretAccessKey && bucket && publicBase) {
    const client = new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" });
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${filename}`;
    const res = await client.fetch(endpoint, {
      method: "PUT",
      body: new Uint8Array(buf),
      headers: { "content-type": contentType },
    });
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
    return `${publicBase.replace(/\/$/, "")}/${filename}`;
  }

  // フォールバック: ローカルファイルシステム
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);
  return `/uploads/${filename}`;
}
