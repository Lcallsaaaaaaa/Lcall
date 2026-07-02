import { AwsClient } from "aws4fetch";

/**
 * R2（S3互換）への署名付きアクセス。
 *
 * 認証情報は運営 env のみ（`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`）。
 * バケットは呼び出し側で指定する（公開メディア用と非公開バックアップ用を分けるため）。
 *
 * 画像アップロード（[storage.ts](src/lib/storage.ts)）は公開バケット＋公開URL返却という別要件のため
 * そちらの実装をそのまま使う。ここは「任意バケットへ署名付きで put/get する」汎用口。
 */

function creds(): { accountId: string; accessKeyId: string; secretAccessKey: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey };
}

/** 署名付きR2アクセスに必要な認証情報が揃っているか。 */
export function r2Ready(): boolean {
  return !!creds();
}

function clientFor(c: NonNullable<ReturnType<typeof creds>>): AwsClient {
  return new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, region: "auto", service: "s3" });
}

function endpoint(accountId: string, bucket: string, key: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURI(key)}`;
}

/**
 * 任意バケットへオブジェクトをPUT。
 * `content-length` を明示して R2 の 411（Length Required／chunked転送拒否）を回避する
 * （Render(Node) の undici が body をストリーム化して Content-Length を落とす問題への対策）。
 */
export async function r2Put(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void> {
  const c = creds();
  if (!c) throw new Error("R2 認証情報が未設定（R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY）");
  const res = await clientFor(c).fetch(endpoint(c.accountId, bucket, key), {
    method: "PUT",
    body: body as BodyInit,
    headers: { "content-type": contentType, "content-length": String(body.byteLength) },
  });
  if (!res.ok) throw new Error(`R2 put failed: ${res.status} (${bucket}/${key})`);
}

/** 任意バケットからオブジェクトをGET（リストア用）。存在しなければ null。 */
export async function r2Get(bucket: string, key: string): Promise<Uint8Array | null> {
  const c = creds();
  if (!c) throw new Error("R2 認証情報が未設定");
  const res = await clientFor(c).fetch(endpoint(c.accountId, bucket, key), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 get failed: ${res.status} (${bucket}/${key})`);
  return new Uint8Array(await res.arrayBuffer());
}
