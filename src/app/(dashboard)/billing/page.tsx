import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Badge, type BadgeTone } from "@/components/ui/StatusBadge";
import { PLANS, PRICING } from "@/config/plans";
import {
  cancelSubscription,
  changePlan,
  chargeMonthly,
  openBillingPortal,
  recoverPayment,
  reportAiUsage,
  simulatePaymentFailure,
  subscribePlan,
} from "@/features/billing/actions";
import { getBilling } from "@/features/billing/queries";
import type { BillingCustomer, Invoice } from "@/lib/data/types";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("ja-JP") : "—");

const STATUS: Record<BillingCustomer["status"], { tone: BadgeTone; label: string }> = {
  active: { tone: "ok", label: "利用中" },
  past_due: { tone: "warn", label: "支払い遅延" },
  paused: { tone: "neutral", label: "停止中" },
  canceled: { tone: "danger", label: "解約済み" },
};

const KIND_LABEL: Record<Invoice["kind"], string> = {
  setup: "初期導入サポート費",
  monthly: "月額料金",
  usage: "AI従量",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const {
    customer,
    planDef,
    invoices,
    suspendAt,
    purgeAt,
    mrr,
    paidTotal,
    aiReplies,
    aiUsageAmount,
    nextInvoiceEstimate,
    stripe,
    stripeTest,
    stripeOnboarded,
    aiUnbilled,
    aiUnbilledAmount,
  } = await getBilling();

  // 申込（Checkout）導線を出すか：未契約／解約／実Stripe有効だが未確立（モック顧客）
  const showSubscribe = !customer || customer.status === "canceled" || (stripe && !stripeOnboarded);
  // 契約中の管理を出すか
  const showManage = !!customer && customer.status !== "canceled" && (!stripe || stripeOnboarded);

  const notice =
    sp.stripe === "success"
      ? { tone: "ok" as const, text: "Stripe決済が完了しました（反映に数秒かかる場合があります）。" }
      : sp.stripe === "cancel"
        ? { tone: "warn" as const, text: "Stripe決済をキャンセルしました。" }
        : sp.stripe === "error"
          ? { tone: "danger" as const, text: `Stripeエラー: ${sp.msg ?? "不明なエラー"}` }
          : null;

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">契約・請求</h1>
          <Badge tone={stripe ? "ok" : "neutral"}>
            {stripe ? (stripeTest ? "Stripe: テスト接続" : "Stripe: 本番接続") : "Stripe: モック"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {stripe
            ? `Stripeで実決済${stripeTest ? "（テストモード・実課金なし）" : ""}。`
            : "クレジットカード決済（モック）。"}
          初期導入サポート費 {yen(PRICING.setupFee)}・月額 {yen(PLANS.lite.monthlyFee)}〜{yen(PLANS.pro.monthlyFee)}・AI応答 {yen(PRICING.aiReplyUnitFee)}/件（すべて税込）。
        </p>
      </div>

      {notice && (
        <div
          className={`mb-5 rounded-lg px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "bg-ok-bg text-ok"
              : notice.tone === "warn"
                ? "bg-warn-bg text-warn"
                : "bg-danger-bg text-danger"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* 現在申込中のプラン（契約があれば常に表示。manageカードを出さない状態でも見えるように） */}
      {customer && customer.status !== "canceled" && !showManage && (
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">現在申込中のプラン</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {planDef?.name ?? "—"}
                <span className="ml-2 text-sm font-normal text-muted">{yen(planDef?.monthlyFee ?? 0)}/月（税込）</span>
              </p>
              <p className="text-xs text-muted">LINE接続 {planDef?.lineLimit} ／ 次回課金 {fmtDate(customer.nextBillingAt)}</p>
            </div>
            <Badge tone={STATUS[customer.status].tone}>{STATUS[customer.status].label}</Badge>
          </div>
        </Card>
      )}

      {/* 未契約 or 実Stripe未確立: プラン選択 */}
      {showSubscribe && (
        <Card className="mb-5">
          <CardHeader
            title="プランを選択"
            description={`初期 ${yen(PRICING.setupFee)}（共通）＋ 月額はプラン別${stripe ? "（申込でStripe Checkoutへ）" : ""}`}
          />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            {Object.values(PLANS).map((p) => {
              const isCurrent = customer?.plan === p.code && customer.status !== "canceled";
              return (
                <div
                  key={p.code}
                  className={`rounded-xl border p-4 text-center ${isCurrent ? "border-brand bg-brand/5" : "border-line"}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-sm font-semibold text-ink">{p.name}</p>
                    {isCurrent && <Badge tone="ok">現在のプラン</Badge>}
                  </div>
                  <p className="mt-1 text-2xl font-semibold text-ink">
                    {yen(p.monthlyFee)}
                    <span className="text-xs font-normal text-muted">/月（税込）</span>
                  </p>
                  <p className="text-xs text-muted">LINE接続 {p.lineLimit}</p>
                  <form action={subscribePlan} className="mt-4">
                    <input type="hidden" name="plan" value={p.code} />
                    <Button type="submit" variant={isCurrent ? "outline" : "gradient"} size="md" className="w-full">
                      {isCurrent ? "申込中のプラン" : stripe ? "Stripeで申し込む" : "申し込む"}
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 契約中 */}
      {showManage && customer && (
        <>
          {customer.status === "past_due" && (
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                支払いに失敗しています。<strong>{fmtDate(suspendAt)}</strong> に配信停止、
                <strong>{fmtDate(purgeAt)}</strong> にデータ削除対象となります。
                {stripe ? "Stripeポータルでカード更新してください。" : "カード更新後「支払いを再試行」してください。"}
              </div>
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm text-muted">現在のプラン</p>
              <p className="mt-2 text-xl font-semibold text-ink">{planDef?.name}</p>
              <p className="text-xs text-muted">LINE接続 {planDef?.lineLimit}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">ステータス</p>
              <div className="mt-2">
                <Badge tone={STATUS[customer.status].tone}>{STATUS[customer.status].label}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted">次回課金 {fmtDate(customer.nextBillingAt)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">月次経常収益(MRR)</p>
              <p className="mt-2 text-xl font-semibold text-ink">{yen(mrr)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">累計支払額</p>
              <p className="mt-2 text-xl font-semibold text-ink">{yen(paidTotal)}</p>
            </Card>
          </div>

          {/* AI従量 */}
          {stripe ? (
            <Card className="mb-5">
              <CardHeader
                title="AI自動応答（従量課金）"
                description={`AI応答 1件あたり ${yen(PRICING.aiReplyUnitFee)}。未計上分をStripeの次回請求に加算します。`}
              />
              <div className="flex flex-wrap items-end justify-between gap-4 p-5">
                <div className="flex gap-8">
                  <div>
                    <p className="text-sm text-muted">未計上のAI応対</p>
                    <p className="mt-1 text-xl font-semibold text-ink">{aiUnbilled.toLocaleString()}件</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted">未計上の従量</p>
                    <p className="mt-1 text-xl font-semibold text-ink">{yen(aiUnbilledAmount)}</p>
                  </div>
                </div>
                <form action={reportAiUsage}>
                  <Button type="submit" variant="outline" size="md">
                    Stripeに計上（次回請求へ）
                  </Button>
                </form>
              </div>
            </Card>
          ) : (
            <Card className="mb-5">
              <CardHeader
                title="AI自動応答（従量課金）"
                description={`AI応答 1件あたり ${yen(PRICING.aiReplyUnitFee)}。前回の月次請求以降の利用分を次回請求に合算します。`}
              />
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted">当期のAI応対数</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{aiReplies.toLocaleString()}件</p>
                </div>
                <div>
                  <p className="text-sm text-muted">AI従量（{yen(PRICING.aiReplyUnitFee)}/件・税込）</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{yen(aiUsageAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">次回請求の見込み（月額＋従量）</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{yen(nextInvoiceEstimate)}</p>
                </div>
              </div>
            </Card>
          )}

          {/* 操作 */}
          <Card className="mb-5">
            <CardHeader title={stripe ? "支払い・契約の管理" : "プラン変更・操作"} />
            <div className="flex flex-wrap items-end gap-3 p-5">
              <form action={changePlan} className="flex items-end gap-2">
                <div>
                  <label className="mb-1.5 block text-xs text-muted">プラン変更</label>
                  <Select name="plan" defaultValue={customer.plan}>
                    {Object.values(PLANS).map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}（{p.lineLimit}）
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="solid" size="md">
                  変更
                </Button>
              </form>
              <span className="h-8 w-px bg-line" />
              {stripe ? (
                <form action={openBillingPortal}>
                  <Button type="submit" variant="gradient" size="md">
                    支払い方法・解約（Stripeポータル）
                  </Button>
                </form>
              ) : (
                <>
                  <form action={chargeMonthly}>
                    <Button type="submit" variant="outline" size="md">
                      月額課金をシミュレート
                    </Button>
                  </form>
                  {customer.status === "past_due" ? (
                    <form action={recoverPayment}>
                      <Button type="submit" variant="gradient" size="md">
                        支払いを再試行
                      </Button>
                    </form>
                  ) : (
                    <form action={simulatePaymentFailure}>
                      <Button type="submit" variant="ghost" size="md">
                        支払い失敗をシミュレート
                      </Button>
                    </form>
                  )}
                  <form action={cancelSubscription}>
                    <button type="submit" className="rounded-lg px-3 py-2 text-sm text-danger transition hover:bg-danger-bg">
                      解約
                    </button>
                  </form>
                </>
              )}
            </div>
          </Card>
        </>
      )}

      {/* 支払い履歴 */}
      <Card>
        <CardHeader title="支払い履歴" />
        {invoices.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted">
            <CreditCard className="size-4" /> まだ請求がありません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">日付</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">種別</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted">金額</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">状態</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-muted">{fmtDate(i.issuedAt)}</td>
                    <td className="px-5 py-3 text-ink">{KIND_LABEL[i.kind]}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink">{yen(i.amount)}</td>
                    <td className="px-5 py-3">
                      {i.status === "paid" ? <Badge tone="ok">支払済</Badge> : <Badge tone="danger">失敗</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
