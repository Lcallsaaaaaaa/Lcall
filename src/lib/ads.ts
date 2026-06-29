/**
 * 広告コンバージョン計測の設定（環境変数）。クライアント（インスタンス）ごとに設定する。
 *
 * - Meta（Facebook/Instagram）: Conversions API（サーバー側）＋ ブラウザPixel。
 *     META_PIXEL_ID, META_CAPI_TOKEN, （任意）META_TEST_EVENT_CODE
 * - Google: GA4 Measurement Protocol（サーバー側）＋ gtag（ブラウザ）。
 *     GA4_MEASUREMENT_ID, GA4_API_SECRET, （任意）GOOGLE_ADS_CONVERSION_ID, GOOGLE_ADS_CONVERSION_LABEL
 *
 * いずれも未設定なら、その媒体への送信はスキップ（コードは常に安全に通る）。
 */
export interface AdsConfig {
  metaPixelId?: string;
  metaCapiToken?: string;
  metaTestEventCode?: string;
  ga4MeasurementId?: string;
  ga4ApiSecret?: string;
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

export function adsConfig(): AdsConfig {
  return {
    metaPixelId: env("META_PIXEL_ID"),
    metaCapiToken: env("META_CAPI_TOKEN"),
    metaTestEventCode: env("META_TEST_EVENT_CODE"),
    ga4MeasurementId: env("GA4_MEASUREMENT_ID"),
    ga4ApiSecret: env("GA4_API_SECRET"),
    googleAdsConversionId: env("GOOGLE_ADS_CONVERSION_ID"),
    googleAdsConversionLabel: env("GOOGLE_ADS_CONVERSION_LABEL"),
  };
}

/** ブラウザPixelを出せるか（PageView/Lead）。 */
export function metaPixelEnabled(c: AdsConfig = adsConfig()): boolean {
  return !!c.metaPixelId;
}
/** サーバー側 Meta Conversions API を送れるか。 */
export function metaCapiEnabled(c: AdsConfig = adsConfig()): boolean {
  return !!(c.metaPixelId && c.metaCapiToken);
}
/** ブラウザ gtag を出せるか。 */
export function googleTagEnabled(c: AdsConfig = adsConfig()): boolean {
  return !!(c.ga4MeasurementId || c.googleAdsConversionId);
}
/** サーバー側 GA4 Measurement Protocol を送れるか。 */
export function ga4ServerEnabled(c: AdsConfig = adsConfig()): boolean {
  return !!(c.ga4MeasurementId && c.ga4ApiSecret);
}

/** 何らかの広告連携が設定されているか（UIの表示出し分け用）。 */
export function anyAdsConfigured(c: AdsConfig = adsConfig()): boolean {
  return metaPixelEnabled(c) || googleTagEnabled(c) || metaCapiEnabled(c) || ga4ServerEnabled(c);
}
