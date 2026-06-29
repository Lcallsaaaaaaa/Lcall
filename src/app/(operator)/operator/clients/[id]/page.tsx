import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Pause, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { Badge, type BadgeTone } from "@/components/ui/StatusBadge";
import { DELIVERY_STEPS, deliveryProgress } from "@/config/delivery-steps";
import { PLANS } from "@/config/plans";
import { refreshInstance, remoteControl, toggleDeliveryStep, updateClient } from "@/features/operator/actions";
import { getClientRow } from "@/features/operator/queries";

const yen = (n: number) => `¥${n.toLocaleString()}`;
const fmt = (s?: string) => (s ? new Date(s).toLocaleString("ja-JP") : "—");
const mask = (s: string) => (s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : "••••");

const CLIENT_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  trial: { tone: "info", label: "トライアル" },
  active: { tone: "ok", label: "稼働中" },
  suspended: { tone: "warn", label: "停止中" },
  canceled: { tone: "neutral", label: "解約" },
};
const INSTANCE_TONE: Record<string, BadgeTone> = { up: "ok", down: "danger", unknown: "neutral" };

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getClientRow(id);
  if (!row) notFound();
  const { client, instance, latest } = row;
  const cs = CLIENT_STATUS[client.status];
  const doneSet = new Set(client.deliverySteps ?? []);
  const prog = deliveryProgress(client.deliverySteps);

  const provisionCmd = instance
    ? `npm run provision -- ${client.slug}` +
      (instance.baseUrl ? ` --base-url ${instance.baseUrl}` : "") +
      (client.contactEmail ? ` --email ${client.contactEmail}` : "") +
      ` --operator-key ${instance.operatorKey}`
    : "";

  return (
    <div className="mx-auto max-w-[960px] p-6 lg:p-8">
      <Link
        href="/operator/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        クライアント一覧へ
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{client.name}</h1>
        <Badge tone={cs.tone}>{cs.label}</Badge>
        <Badge tone="neutral">{PLANS[client.plan].name}</Badge>
        {instance && <Badge tone={INSTANCE_TONE[instance.status]}>{instance.status}</Badge>}
      </div>

      {/* インスタンス & 遠隔操作 */}
      <Card className="mb-5">
        <CardHeader
          title="インスタンス"
          description="稼働状態の確認と遠隔操作（配信の一時停止/再開）。"
          action={
            instance ? (
              <form action={refreshInstance.bind(null, client.id, instance.id)}>
                <Button type="submit" variant="outline" size="sm">
                  <RefreshCw className="size-3.5" />
                  今すぐ確認
                </Button>
              </form>
            ) : undefined
          }
        />
        <div className="space-y-3 p-5 text-sm">
          {!instance ? (
            <p className="text-muted">インスタンス未登録です。</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <Row label="公開URL">
                  {instance.baseUrl ? (
                    <a href={instance.baseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                      {instance.baseUrl} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-faint">未設定</span>
                  )}
                </Row>
                <Row label="管理画面">
                  {instance.baseUrl ? (
                    <a href={`${instance.baseUrl}/login`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                      ログインへ <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Row>
                <Row label="状態"><Badge tone={INSTANCE_TONE[instance.status]}>{instance.status}</Badge></Row>
                <Row label="最終確認">{fmt(instance.lastSeenAt)}</Row>
                <Row label="アプリ版">{instance.appVersion ?? "—"}</Row>
                <Row label="運営キー"><code className="text-xs text-muted">{mask(instance.operatorKey)}</code></Row>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="text-xs text-muted">遠隔操作：</span>
                <form action={remoteControl.bind(null, client.id, instance.id, "suspend")}>
                  <Button type="submit" variant="outline" size="sm">
                    <Pause className="size-3.5" />
                    配信を一時停止
                  </Button>
                </form>
                <form action={remoteControl.bind(null, client.id, instance.id, "resume")}>
                  <Button type="submit" variant="outline" size="sm">
                    <Play className="size-3.5" />
                    再開
                  </Button>
                </form>
                {latest?.billingStatus && (
                  <span className="ml-auto text-xs text-muted">請求: {latest.billingStatus}</span>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* 納品チェックリスト */}
      <Card className="mb-5">
        <CardHeader
          title="納品チェックリスト"
          description={prog.delivered ? "必須ステップ完了＝納品済み" : `必須 ${prog.doneRequired}/${prog.totalRequired} 完了`}
          action={
            prog.delivered ? (
              <Badge tone="ok">納品済み</Badge>
            ) : (
              <Badge tone="neutral">{prog.doneRequired}/{prog.totalRequired}</Badge>
            )
          }
        />
        <ul className="divide-y divide-line">
          {DELIVERY_STEPS.map((step) => {
            const done = doneSet.has(step.key);
            return (
              <li key={step.key} className="flex items-start gap-3 p-4">
                <form action={toggleDeliveryStep.bind(null, client.id, step.key)}>
                  <button
                    type="submit"
                    className="mt-0.5 rounded transition hover:opacity-80"
                    title={done ? "未完了に戻す" : "完了にする"}
                  >
                    {done ? (
                      <CheckCircle2 className="size-5 text-brand" />
                    ) : (
                      <Circle className="size-5 text-faint" />
                    )}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={done ? "font-medium text-ink" : "text-ink"}>{step.label}</span>
                    {step.optional && <Badge tone="neutral">任意</Badge>}
                  </div>
                  {step.hint && <p className="mt-0.5 text-xs text-muted">{step.hint}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 最新メトリクス */}
      <Card className="mb-5">
        <CardHeader title="最新メトリクス" description={latest ? `取得 ${fmt(latest.capturedAt)}` : "未取得（「今すぐ確認」で取得）"} />
        <div className="p-5">
          {latest ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="友だち" value={latest.totalFriends.toLocaleString()} />
              <Metric label="有効" value={latest.activeFriends.toLocaleString()} />
              <Metric label="配信" value={latest.deliveries.toLocaleString()} />
              <Metric label="クリック" value={latest.clicks.toLocaleString()} />
              <Metric label="AI応対" value={latest.aiReplies.toLocaleString()} />
              <Metric label="MRR" value={yen(latest.mrr ?? 0)} />
            </div>
          ) : (
            <p className="text-sm text-muted">まだ取得していません。上の「今すぐ確認」を押すとインスタンスから取得します。</p>
          )}
        </div>
      </Card>

      {/* 発行手順（provision） */}
      {instance && (
        <Card className="mb-5">
          <CardHeader title="インスタンスの起動手順" description="このコマンドでクライアント専用インスタンスの .env を生成します（運営キーが一致します）。" />
          <div className="space-y-3 p-5">
            <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink">{provisionCmd}</pre>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>上記コマンドを実行（<code>clients/{client.slug}/.env</code> が生成・初期PWが一度だけ表示）。</li>
              <li>本番DBを使うなら <code>.env</code> に <code>DATABASE_URL</code> を設定（Supabase等）。必要に応じ <code>ANTHROPIC_API_KEY</code>/<code>STRIPE_*</code>/<code>R2_*</code>。</li>
              <li><code>npm run build</code> →{" "}
                <code>node --env-file=clients/{client.slug}/.env ./node_modules/next/dist/bin/next start</code> で起動。
              </li>
              <li>固定HTTPSのURLを上の「公開URL」に設定 → 「今すぐ確認」で監視開始。</li>
            </ol>
          </div>
        </Card>
      )}

      {/* 編集 */}
      <Card>
        <CardHeader title="台帳の編集" />
        <form action={updateClient.bind(null, client.id)} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="クライアント名" htmlFor="name" required>
              <Input id="name" name="name" defaultValue={client.name} required />
            </FormField>
            <FormField label="連絡先メール" htmlFor="contactEmail">
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={client.contactEmail} />
            </FormField>
            <FormField label="プラン" htmlFor="plan">
              <Select id="plan" name="plan" defaultValue={client.plan}>
                {Object.values(PLANS).map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="契約状態" htmlFor="status">
              <Select id="status" name="status" defaultValue={client.status}>
                <option value="trial">トライアル</option>
                <option value="active">稼働中</option>
                <option value="suspended">停止中</option>
                <option value="canceled">解約</option>
              </Select>
            </FormField>
            <FormField
              label="Stripe顧客ID（cus_…）"
              htmlFor="stripeCustomerId"
              className="sm:col-span-2"
              hint="申込時の支払い情報（カードはStripe保管）と納品インスタンスの請求を結ぶ鍵"
            >
              <Input id="stripeCustomerId" name="stripeCustomerId" defaultValue={client.stripeCustomerId ?? ""} placeholder="cus_xxxxxxxxxxxx" />
            </FormField>
            <FormField label="公開URL" htmlFor="baseUrl" className="sm:col-span-2">
              <Input id="baseUrl" name="baseUrl" defaultValue={instance?.baseUrl ?? ""} placeholder="https://..." />
            </FormField>
            <FormField label="ホスティングのメモ" htmlFor="hostingNote" className="sm:col-span-2">
              <Input id="hostingNote" name="hostingNote" defaultValue={instance?.hostingNote ?? ""} />
            </FormField>
          </div>
          <FormField label="メモ" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={client.notes ?? ""} />
          </FormField>
          <div className="flex justify-end">
            <button type="submit" className={buttonClasses("solid", "md")}>保存</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}
