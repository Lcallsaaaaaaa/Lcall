import { readFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { getDataProvider } from "@/lib/data/provider";
import type { DataProvider } from "@/lib/data/repository";

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
    // アプリ内蔵保管（/api/img/{id}）は DB から直接読む（相対・絶対どちらのURLでも）
    const m = url.match(/\/api\/img\/([^/?#]+)/);
    if (m) {
      const img = await getDataProvider().storedImages.get(decodeURIComponent(m[1]));
      if (!img) return null;
      return { buffer: Buffer.from(img.data, "base64"), contentType: img.contentType };
    }
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
 * R2（S3互換）の環境変数が揃っていれば R2 へ、無ければアプリ内蔵（DB）へ保存。
 * @param kind "chat"=LINE受信画像（保存期間で自動削除対象）/ "asset"=メディア・カルーセル等（保持）
 */
export async function saveImageBytes(
  buf: Buffer,
  contentType: string,
  kind: "chat" | "asset" = "asset"
): Promise<string> {
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
    // R2 は PUT に Content-Length 必須（aws4fetch は body をストリーム化し chunked になるため 411 になる）。
    // 明示的に content-length を付けて chunked を防ぐ。Node(undici) では content-length を手動指定できる。
    const body = new Uint8Array(buf);
    const res = await client.fetch(endpoint, {
      method: "PUT",
      body,
      headers: {
        "content-type": contentType,
        "content-length": String(body.byteLength),
      },
    });
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
    return `${publicBase.replace(/\/$/, "")}/${filename}`;
  }

  // フォールバック: アプリ内蔵保管（DBに保存し /api/img/{id} で配信）。
  // ローカルファイルは Render 等の本番で配信/永続化できないため使わない。
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await getDataProvider().storedImages.create({
    id,
    contentType,
    data: buf.toString("base64"),
    kind,
    createdAt: new Date().toISOString(),
  });
  // LCALL_PUBLIC_BASE_URL があれば絶対URL（LINEカルーセル画像はHTTPS絶対URL必須）。無ければ相対。
  const base = process.env.LCALL_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  return `${base}/api/img/${id}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_THROTTLE_MS = 12 * 60 * 60 * 1000; // 全件読込が重いので最短12時間に1回だけ実行
const PURGE_AT_KEY = "image_purge_at";

/**
 * 保存期間を過ぎた「受信画像（kind=chat）」をDBから自動削除して容量を抑える。
 * - `LCALL_IMAGE_RETENTION_DAYS`（日数。未設定/0なら無期限保持＝何もしない）。
 * - 対象は受信画像のみ。メディア/カルーセル等（kind=asset）は削除しない。
 * - 削除した画像を参照していたチャットは「[画像（保存期間終了）]」表示に置換。
 * - cron（/api/scenarios/run）から毎回呼ばれるが、内部で12時間に1回へ間引く。
 * R2運用時はR2側のライフサイクルルールで期限管理するため、ここでは何もしない。
 */
export async function purgeExpiredChatImages(
  db: DataProvider
): Promise<{ purged: number; skipped?: string }> {
  const days = Number(process.env.LCALL_IMAGE_RETENTION_DAYS ?? "");
  if (!Number.isFinite(days) || days <= 0) return { purged: 0, skipped: "disabled" };

  // スロットル: 前回実行から十分時間が経っていなければスキップ（systemSettings に最終実行時刻）
  const settings = await db.systemSettings.list();
  const last = settings.find((s) => s.key === PURGE_AT_KEY);
  const now = Date.now();
  if (last?.value && now - new Date(last.value).getTime() < PURGE_THROTTLE_MS) {
    return { purged: 0, skipped: "throttled" };
  }

  const cutoff = now - days * DAY_MS;
  const images = await db.storedImages.list();
  const expired = images.filter(
    (img) => (img.kind ?? "asset") === "chat" && new Date(img.createdAt).getTime() < cutoff
  );

  for (const img of expired) {
    await db.storedImages.remove(img.id);
  }

  // 期限切れ画像を参照していたチャットを「保存期間終了」表示に置き換える（壊れた画像アイコンを防ぐ）
  if (expired.length > 0) {
    const expiredIds = expired.map((i) => i.id);
    const messages = await db.chatMessages.list();
    for (const m of messages) {
      if (m.imageUrl && expiredIds.some((id) => m.imageUrl!.includes(id))) {
        await db.chatMessages.update(m.id, { imageUrl: "", text: "[画像（保存期間終了）]" });
      }
    }
  }

  // 最終実行時刻を記録
  const stamp = new Date(now).toISOString();
  if (last) await db.systemSettings.update(last.id, { value: stamp });
  else await db.systemSettings.create({ id: `set_${now}`, key: PURGE_AT_KEY, value: stamp });

  return { purged: expired.length };
}
