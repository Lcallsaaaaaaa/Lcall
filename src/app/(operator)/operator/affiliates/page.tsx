import { Share2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/StatusBadge";
import { getDataProvider } from "@/lib/data/provider";

/**
 * アフィリエイト（外部パートナー→クライアント獲得）。
 * 今回はスキーマのみ（affiliates / affiliateReferrals / affiliateCommissions）。UI・成果計上・報酬支払は次回。
 */
export default async function OperatorAffiliatesPage() {
  const db = getDataProvider();
  const [affiliates, referrals, commissions] = await Promise.all([
    db.affiliates.list(),
    db.affiliateReferrals.list(),
    db.affiliateCommissions.list(),
  ]);

  return (
    <div className="mx-auto max-w-[900px] p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">アフィリエイト</h1>
        <Badge tone="info">設計のみ（次回実装）</Badge>
      </div>

      <Card className="mb-5">
        <CardHeader title="このフェーズの状態" />
        <div className="space-y-3 p-5 text-sm text-muted">
          <p className="inline-flex items-center gap-2 text-ink">
            <Share2 className="size-4 text-brand" />
            外部パートナーが新規クライアントを紹介し、成約で報酬を得る仕組みです。
          </p>
          <p>
            台帳DBにスキーマを用意済み（<code>affiliates</code> / <code>affiliateReferrals</code> /{" "}
            <code>affiliateCommissions</code>）。紹介リンク発行・成約計上・報酬集計/支払のUIは次回実装します。
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Affiliate</b>：紹介者（コード・連絡先・状態・支払先メモ）</li>
            <li><b>AffiliateReferral</b>：紹介の発生〜成約（clicked → signed_up → converted、成約クライアント紐付け）</li>
            <li><b>AffiliateCommission</b>：報酬（signup 一括 / recurring 月次レベニューシェア・pending/approved/paid）</li>
          </ul>
          <p>クライアント発行時に <code>ClientAccount.affiliateId</code> で獲得元を紐付けられます。</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="現在のデータ" />
        <div className="grid grid-cols-3 divide-x divide-line">
          <Count label="紹介者" n={affiliates.length} />
          <Count label="紹介" n={referrals.length} />
          <Count label="報酬" n={commissions.length} />
        </div>
      </Card>
    </div>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <div className="px-5 py-6 text-center">
      <p className="text-2xl font-semibold tabular-nums text-ink">{n}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
