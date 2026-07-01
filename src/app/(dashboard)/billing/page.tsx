import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { Badge, type BadgeTone } from "@/components/ui/StatusBadge";
import { ADDONS, PLANS, PLAN_FEATURES, PRICING, planHasFeature } from "@/config/plans";
import type { PlanCode } from "@/lib/data/types";
import {
  cancelSubscription,
  changePlan,
  chargeMonthly,
  openBillingPortal,
  recoverPayment,
  simulatePaymentFailure,
  subscribePlan,
} from "@/features/billing/actions";
import { ensurePrepaidBillingCustomer } from "@/features/billing/ensure";
import { getBilling } from "@/features/billing/queries";
import type { BillingCustomer, Invoice } from "@/lib/data/types";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("ja-JP") : "—");

/** プランに含まれる機能ラベル一覧（準備中は除く）。 */
const planFeatureLabels = (code: PlanCode) =>
  PLAN_FEATURES.filter((f) => !f.comingSoon && planHasFeature(code, f.key)).map((f) => f.label);

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
  // 納品前にStripeで採番した顧客ID（env）を初回に BillingCustomer へ引き継ぐ（冪等）。
  await ensurePrepaidBillingCustomer();
  const {
    customer,
    planDef,
    invoices,
    suspendAt,
    purgeAt,
    mrr,
    paidTotal,
    aiReplies,
    aiMonthlyLimit,
    stripe,
    stripeTest,
    stripeOnboarded,
  } = await getBilling();

  // 申込（Checkout）導線を出すか：未契約／解約／実Stripe有効だが未確立（モック顧客）
  const showSubscribe = !customer || customer.status === "canceled" || (stripe && !stripeOnboarded);
  // 契約中の管理を出すか
  const showManage = !!customer && customer.status !== "canceled" && (!stripe || stripeOnboarded);
  // 現在のプラン（解約済みは対象外）。比較表の現在列ハイライト用。
  const currentPlanCode: PlanCode | undefined =
    customer && customer.status !== "canceled" ? customer.plan : undefined;

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
          <br />
          <span className="text-faint">月額は日割りなし（申込日を起算に毎月課金）。プラン変更は即時切替・次回請求から新料金。</span>
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

      {/* プラン比較（機能の出し分け）。常に表示し、現在のプラン列をハイライト。 */}
      <Card className="mb-5">
        <CardHeader title="プラン比較" description="プランごとに使える機能（現在のプランをハイライト）" />
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">機能</th>
                {Object.values(PLANS).map((p) => (
                  <th
                    key={p.code}
                    className={`px-3 py-2 text-center text-sm font-semibold ${currentPlanCode === p.code ? "rounded-t-md bg-brand/5 text-brand" : "text-ink"}`}
                  >
                    {p.name}
                    {currentPlanCode === p.code && <span className="ml-1 text-[10px] font-normal">（現在）</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <td className="px-3 py-2 text-muted">月額（税込）</td>
                {Object.values(PLANS).map((p) => (
                  <td key={p.code} className={`px-3 py-2 text-center text-ink ${currentPlanCode === p.code ? "bg-brand/5" : ""}`}>
                    {yen(p.monthlyFee)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-line/60">
                <td className="px-3 py-2 text-muted">LINE公式アカウント接続（有効数）</td>
                {Object.values(PLANS).map((p) => (
                  <td key={p.code} className={`px-3 py-2 text-center text-ink ${currentPlanCode === p.code ? "bg-brand/5" : ""}`}>
                    {p.lineLimit}
                  </td>
                ))}
              </tr>
              {PLAN_FEATURES.map((f) => (
                <tr key={f.key} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 text-muted">
                    {f.label}
                    {f.comingSoon && <span className="ml-1 text-[10px] text-faint">（準備中）</span>}
                  </td>
                  {Object.values(PLANS).map((p) => (
                    <td key={p.code} className={`px-3 py-2 text-center ${currentPlanCode === p.code ? "bg-brand/5" : ""}`}>
                      {planHasFeature(p.code, f.key) ? (
                        <span className="font-semibold text-ok">✓</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 任意オプション（基本プランへの追加）。 */}
      <Card className="mb-5">
        <CardHeader title="オプション（任意）" description="基本プランに追加できます" />
        <div className="p-2">
          {ADDONS.map((a) => (
            <div
              key={a.key}
              className="flex items-start justify-between gap-3 border-b border-line px-3 py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-ink">{a.label}</p>
                {a.description && <p className="mt-0.5 text-xs text-muted">{a.description}</p>}
              </div>
              <p className="shrink-0 text-sm font-semibold text-ink">
                {yen(a.amount)}
                <span className="text-xs font-normal text-muted">{a.recurring ? "/月" : "（一回）"}</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* 大規模改修・カスタム（要相談）。標準3プランの範囲を超える要望向け。 */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-ink">相談プラン（大規模改修・カスタム開発）</p>
              <Badge tone="info">要相談</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              専用機能の開発・外部システム連携・デザイン全面変更・複数店舗の特殊運用など、標準プランの範囲を超えるご要望に個別お見積りで対応します。担当者までお問い合わせください。
            </p>
            <p className="mt-1 text-xs text-faint">料金：内容に応じて個別お見積り</p>
          </div>
        </div>
      </Card>

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
              {planDef && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {planFeatureLabels(planDef.code).map((l) => (
                    <Badge key={l} tone="neutral">{l}</Badge>
                  ))}
                </div>
              )}
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

          {/* AI自動応答（プランに含む・月間上限あり） */}
          <Card className="mb-5">
            <CardHeader
              title="AI自動応答（プランに含む）"
              description={`月間 ${aiMonthlyLimit.toLocaleString()}回まで無料で含まれます。上限を超えると当月はAI自動応答を停止します（追加請求はありません）。`}
            />
            <div className="p-5">
              <p className="text-sm text-muted">今月のAI応答</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {aiReplies.toLocaleString()} / {aiMonthlyLimit.toLocaleString()} 回
              </p>
              {aiReplies >= aiMonthlyLimit && (
                <p className="mt-2 text-sm text-danger">
                  今月の上限に達したため、AI自動応答は停止中です（来月1日にリセット）。
                </p>
              )}
            </div>
          </Card>

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
