import crypto from "node:crypto";

/**
 * LINE Messaging API クライアント（受信Webhookの署名検証・返信送信・プロフィール取得）。
 * Node ランタイム前提（crypto 使用）。
 */

const LINE_API = "https://api.line.me/v2/bot";
/** メッセージのコンテンツ（画像・動画等のバイト列）取得は data ドメイン。 */
const LINE_DATA_API = "https://api-data.line.me/v2/bot";

/** Webhook 署名検証（X-Line-Signature = base64(HMAC-SHA256(channelSecret, rawBody))）。 */
export function verifyLineSignature(
  channelSecret: string,
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature || !channelSecret) return false;
  const expected = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** ダミー/未設定トークンを実送信から除外するためのガード。 */
export function isRealToken(token: string | undefined | null): boolean {
  return !!token && token !== "demo_token" && token.length > 20;
}

/** ユーザーへテキストを push 送信（受信箱からの返信に使用）。 */
export async function pushText(
  accessToken: string,
  to: string,
  text: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(`${LINE_API}/message/push`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: await res.text().catch(() => "") };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

export interface CarouselColumn {
  thumbnailImageUrl?: string;
  title: string;
  text: string;
  uri: string;
  label: string;
}

/** カルーセル（template/carousel）を push 送信。最大10カラム、文字数はLINE制約に丸める。 */
export async function pushCarousel(
  accessToken: string,
  to: string,
  altText: string,
  columns: CarouselColumn[]
): Promise<{ ok: boolean; status: number; error?: string }> {
  const cols = columns.slice(0, 10).map((c) => ({
    ...(c.thumbnailImageUrl && /^https:\/\//.test(c.thumbnailImageUrl)
      ? { thumbnailImageUrl: c.thumbnailImageUrl }
      : {}),
    title: (c.title || " ").slice(0, 40),
    text: (c.text || " ").slice(0, 60),
    actions: [{ type: "uri", label: (c.label || "開く").slice(0, 20), uri: c.uri }],
  }));
  try {
    const res = await fetch(`${LINE_API}/message/push`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        to,
        messages: [
          { type: "template", altText: (altText || "カルーセル").slice(0, 400), template: { type: "carousel", columns: cols } },
        ],
      }),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: await res.text().catch(() => "") };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

/** replyToken でテキスト返信（自動応答用。replyToken は短命）。 */
export async function replyText(
  accessToken: string,
  replyToken: string,
  text: string
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(`${LINE_API}/message/reply`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * 受信メッセージのコンテンツ（画像など）を取得する。
 * GET https://api-data.line.me/v2/bot/message/{messageId}/content
 */
export async function getMessageContent(
  accessToken: string,
  messageId: string
): Promise<{ ok: boolean; status: number; buffer?: Buffer; contentType?: string }> {
  try {
    const res = await fetch(`${LINE_DATA_API}/message/${encodeURIComponent(messageId)}/content`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { ok: true, status: res.status, buffer, contentType };
  } catch {
    return { ok: false, status: 0 };
  }
}

// ===== リッチメニュー（Rich Menu API） =====

export interface RichMenuPayloadArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: Record<string, unknown>;
}

export interface RichMenuPayload {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: RichMenuPayloadArea[];
}

/** リッチメニューを作成（画像は別途アップロードが必要）。成功時は richMenuId を返す。 */
export async function createRichMenu(
  accessToken: string,
  payload: RichMenuPayload
): Promise<{ ok: boolean; status: number; richMenuId?: string; error?: string }> {
  try {
    const res = await fetch(`${LINE_API}/richmenu`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, status: res.status, error: await res.text().catch(() => "") };
    const data = (await res.json()) as { richMenuId?: string };
    return { ok: true, status: res.status, richMenuId: data.richMenuId };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

/** リッチメニューの画像をアップロード（JPEG/PNG・最大1MB・data ドメイン）。 */
export async function uploadRichMenuImage(
  accessToken: string,
  richMenuId: string,
  buffer: Buffer,
  contentType: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(`${LINE_DATA_API}/richmenu/${encodeURIComponent(richMenuId)}/content`, {
      method: "POST",
      headers: { "content-type": contentType, authorization: `Bearer ${accessToken}` },
      body: new Uint8Array(buffer),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: await res.text().catch(() => "") };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

/** このリッチメニューを「全員の既定メニュー」に設定。 */
export async function setDefaultRichMenu(
  accessToken: string,
  richMenuId: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(`${LINE_API}/user/all/richmenu/${encodeURIComponent(richMenuId)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: await res.text().catch(() => "") };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

/** 全員の既定メニュー設定を解除。 */
export async function clearDefaultRichMenu(
  accessToken: string
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(`${LINE_API}/user/all/richmenu`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** 指定ユーザー群にリッチメニューを一括リンク（最大500件/回。呼び出し側でチャンク）。 */
export async function linkRichMenuBulk(
  accessToken: string,
  richMenuId: string,
  userIds: string[]
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(`${LINE_API}/richmenu/bulk/link`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ richMenuId, userIds: userIds.slice(0, 500) }),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: await res.text().catch(() => "") };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

/** リッチメニューを削除。 */
export async function deleteRichMenu(
  accessToken: string,
  richMenuId: string
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(`${LINE_API}/richmenu/${encodeURIComponent(richMenuId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** 友だちプロフィール取得（新規受信時の表示名に使用）。 */
export async function getProfile(
  accessToken: string,
  userId: string
): Promise<{ displayName?: string; pictureUrl?: string }> {
  try {
    const res = await fetch(`${LINE_API}/profile/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    return (await res.json()) as { displayName?: string; pictureUrl?: string };
  } catch {
    return {};
  }
}
