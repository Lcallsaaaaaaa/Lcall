import Script from "next/script";
import { buttonClasses } from "@/components/ui/Button";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { adsConfig, googleTagEnabled, metaPixelEnabled } from "@/lib/ads";

export const dynamic = "force-dynamic";

/**
 * 広告出稿用のタグ付き着地ページ（①ブラウザPixel/gtag）。
 * 広告の遷移先を `/j?ad=CODE` にすると、ここで Meta Pixel / Google タグが発火（PageView）し、
 * リマーケティング用データが媒体に渡る。ボタンで `/api/distribute` 経由でLINE友だち追加へ。
 * gclid/fbclid は媒体が自動付与 → そのまま distribute へ引き継ぎ、友だち追加時のコンバージョンに使う。
 * ※タグ不要ならこのページを使わず `/api/distribute?ad=CODE` を直接遷移先にしてもよい。
 */
export default async function JoinLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ ad?: string; gclid?: string; fbclid?: string }>;
}) {
  const sp = await searchParams;
  const cfg = adsConfig();

  const params = new URLSearchParams();
  if (sp.ad) params.set("ad", sp.ad);
  if (sp.gclid) params.set("gclid", sp.gclid);
  if (sp.fbclid) params.set("fbclid", sp.fbclid);
  const distributeUrl = `/api/distribute${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      {metaPixelEnabled(cfg) && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${cfg.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {googleTagEnabled(cfg) && cfg.ga4MeasurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${cfg.ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${cfg.ga4MeasurementId}');`}
          </Script>
        </>
      )}

      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <GradientLogo />
        </div>
        <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h1 className="text-xl font-semibold text-ink">LINEで友だち追加</h1>
          <p className="mt-2 text-sm text-muted">
            下のボタンから友だち追加して、お得な情報を受け取ってください。
          </p>
          <a id="join-btn" href={distributeUrl} className={buttonClasses("gradient", "lg", "mt-6 w-full")}>
            友だち追加する
          </a>
        </div>
        <p className="mt-6 text-center text-xs text-faint">Powered by LCall</p>
      </div>

      {/* クリック時に Lead/コンバージョンイベントを発火（ベストエフォート） */}
      <Script id="join-lead" strategy="afterInteractive">
        {`var b=document.getElementById('join-btn');if(b){b.addEventListener('click',function(){try{if(window.fbq)fbq('track','Lead');}catch(e){}try{if(window.gtag)gtag('event','generate_lead');}catch(e){}});}`}
      </Script>
    </main>
  );
}
