import { adsConfig, ga4ServerEnabled, metaCapiEnabled } from "@/lib/ads";
import type { DataProvider } from "@/lib/data/repository";
import type { ConversionLog } from "@/lib/data/types";

/** 友だち追加（コンバージョン）を媒体へ送るための信号。登録ログ＋友だちから集める。 */
export interface FriendAddSignals {
  friendId: string;
  adCode?: string;
  gclid?: string;
  fbclid?: string;
  fbp?: string;
  clientIp?: string;
  userAgent?: string;
  /** クリック（着地）時刻ms。Meta の fbc 生成に使う（無ければ現在時刻） */
  clickTimeMs?: number;
}

function uid(): string {
  return `conv_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function log(
  db: DataProvider,
  entry: Omit<ConversionLog, "id" | "createdAt">
): Promise<void> {
  await db.conversionLogs.create({ id: uid(), createdAt: new Date().toISOString(), ...entry });
}

/**
 * 友だち追加を Meta Conversions API / GA4 Measurement Protocol へサーバー側送信する。
 * 各媒体は環境変数が揃っているときだけ送信。失敗しても例外は投げない（呼び出し側の処理を止めない）。
 * 送信結果は conversionLogs に記録する。
 */
export async function sendFriendAddConversion(db: DataProvider, s: FriendAddSignals): Promise<void> {
  const cfg = adsConfig();
  const eventTime = Math.floor(Date.now() / 1000);

  // ---- Meta Conversions API ----
  if (metaCapiEnabled(cfg)) {
    if (!s.fbclid && !s.clientIp) {
      await log(db, {
        platform: "meta",
        event: "CompleteRegistration",
        adCode: s.adCode,
        friendId: s.friendId,
        status: "skipped",
        detail: "クリックID(fbclid)/IP が無くマッチ情報不足",
      });
    } else {
      try {
        const clickMs = s.clickTimeMs ?? Date.now();
        const userData: Record<string, unknown> = {};
        if (s.fbclid) userData.fbc = `fb.1.${clickMs}.${s.fbclid}`;
        if (s.fbp) userData.fbp = s.fbp;
        if (s.clientIp) userData.client_ip_address = s.clientIp;
        if (s.userAgent) userData.client_user_agent = s.userAgent;
        const body: Record<string, unknown> = {
          data: [
            {
              event_name: "CompleteRegistration",
              event_time: eventTime,
              action_source: "website",
              event_source_url: process.env.LCALL_PUBLIC_BASE_URL?.trim() || undefined,
              user_data: userData,
              custom_data: { content_name: s.adCode ?? "line_friend_add" },
            },
          ],
        };
        if (cfg.metaTestEventCode) body.test_event_code = cfg.metaTestEventCode;
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${cfg.metaPixelId}/events?access_token=${encodeURIComponent(cfg.metaCapiToken!)}`,
          { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        );
        await log(db, {
          platform: "meta",
          event: "CompleteRegistration",
          adCode: s.adCode,
          friendId: s.friendId,
          status: res.ok ? "sent" : "failed",
          detail: `HTTP ${res.status}`,
        });
      } catch (e) {
        await log(db, {
          platform: "meta",
          event: "CompleteRegistration",
          adCode: s.adCode,
          friendId: s.friendId,
          status: "failed",
          detail: String(e).slice(0, 200),
        });
      }
    }
  }

  // ---- Google GA4 Measurement Protocol ----
  // GA4 を Google 広告に連携し generate_lead をコンバージョンとしてインポートすると、広告側で計測できる。
  if (ga4ServerEnabled(cfg)) {
    try {
      const clientId = s.gclid || s.friendId; // GA4 の client_id（必須）。gclid を優先
      const params: Record<string, unknown> = { engagement_time_msec: 1 };
      if (s.gclid) params.gclid = s.gclid;
      if (s.adCode) params.ad_code = s.adCode;
      const res = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(cfg.ga4MeasurementId!)}&api_secret=${encodeURIComponent(cfg.ga4ApiSecret!)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ client_id: clientId, events: [{ name: "generate_lead", params }] }),
        }
      );
      await log(db, {
        platform: "google",
        event: "generate_lead",
        adCode: s.adCode,
        friendId: s.friendId,
        status: res.ok ? "sent" : "failed",
        detail: `HTTP ${res.status}`,
      });
    } catch (e) {
      await log(db, {
        platform: "google",
        event: "generate_lead",
        adCode: s.adCode,
        friendId: s.friendId,
        status: "failed",
        detail: String(e).slice(0, 200),
      });
    }
  }
}
