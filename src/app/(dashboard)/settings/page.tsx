import { CheckCircle2, CreditCard, Link2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { paymentSettingsStatus } from "@/features/reservations/payments";
import { savePaymentSettings, clearPaymentSettings } from "@/features/settings/actions";
import { publicBaseUrl } from "@/lib/url";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await getSession();
  if (session?.role === "staff") redirect("/inbox");
  await searchParams;

  const [status, base] = await Promise.all([
    paymentSettingsStatus(getDataProvider()),
    publicBaseUrl(),
  ]);
  const webhookUrl = `${base}/api/stripe/webhook`;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">設定</h1>
        <p className="mt-1 text-sm text-muted">決済（Stripe）など、店舗ごとの設定を行います。</p>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="決済設定（Stripe）"
          description="予約の事前支払いを、お店ご自身のStripeアカウントで受け取るための設定です。"
        />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CreditCard className="size-4 text-muted" />
            <span className="text-muted">状態：</span>
            {status.secretSet ? (
              <Badge tone="ok">
                設定済み（••••{status.secretTail}{status.isTest ? "・テスト" : "・本番"}）
              </Badge>
            ) : (
              <Badge tone="warn">未設定（事前支払いは利用できません）</Badge>
            )}
            <span className="text-muted">／ Webhook：</span>
            {status.webhookSet ? <Badge tone="ok">設定済み</Badge> : <Badge tone="warn">未設定</Badge>}
          </div>

          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            Stripeダッシュボードのキーをここに貼り付けてください（保存後は末尾4桁のみ表示）。本番は <code className="text-ink">sk_live_</code>、テストは <code className="text-ink">sk_test_</code> で始まります。
          </p>

          <form action={savePaymentSettings} className="space-y-4">
            <FormField label="Stripe シークレットキー" htmlFor="stripeSecretKey" hint="空欄のまま保存すると現在の値を維持します">
              <Input id="stripeSecretKey" name="stripeSecretKey" type="password" autoComplete="off" placeholder={status.secretSet ? "（設定済み・変更する場合のみ入力）" : "sk_live_... / sk_test_..."} />
            </FormField>
            <FormField label="Stripe Webhookシークレット" htmlFor="stripeWebhookSecret" hint="Stripeダッシュボードでwebhook登録後に表示される whsec_...">
              <Input id="stripeWebhookSecret" name="stripeWebhookSecret" type="password" autoComplete="off" placeholder={status.webhookSet ? "（設定済み・変更する場合のみ入力）" : "whsec_..."} />
            </FormField>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="solid" size="md">保存</Button>
            </div>
          </form>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-2 text-sm font-medium text-ink">Stripeに登録するWebhook URL</p>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <Link2 className="size-3.5 shrink-0 text-muted" />
              <code className="truncate text-xs text-ink">{webhookUrl}</code>
            </div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted">
              <li>Stripeダッシュボード → 開発者 → Webhook で、上記URLを「エンドポイントを追加」</li>
              <li>イベントは <code className="text-ink">checkout.session.completed</code> を選択</li>
              <li>表示される署名シークレット（<code className="text-ink">whsec_…</code>）を上の「Webhookシークレット」に保存</li>
              <li>予約ページの設定で「事前支払い：全額前払い」にすると決済が有効になります</li>
            </ol>
          </div>

          {status.secretSet && (
            <form action={clearPaymentSettings}>
              <button type="submit" className="text-xs text-danger hover:underline">
                決済設定をクリアする
              </button>
            </form>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="ご注意" />
        <div className="space-y-1.5 p-5 text-xs text-muted">
          <p className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
            ここで設定したStripeキーは、予約の事前支払いに使われ、売上はお店ご自身のStripeに入金されます。
          </p>
          <p className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
            キーは管理者のみ設定できます。第三者に教えないでください。
          </p>
        </div>
      </Card>
    </div>
  );
}
