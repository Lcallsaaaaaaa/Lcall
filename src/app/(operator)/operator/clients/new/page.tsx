import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { PLANS } from "@/config/plans";
import { createClient } from "@/features/operator/actions";
import { getDataProvider } from "@/lib/data/provider";

export default async function NewClientPage() {
  const affiliates = (await getDataProvider().affiliates.list()).filter((a) => a.status === "active");
  return (
    <div className="mx-auto max-w-[760px] p-6 lg:p-8">
      <Link
        href="/operator/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        クライアント一覧へ
      </Link>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">新規クライアント発行</h1>
      <p className="mb-6 text-sm text-muted">
        台帳に登録し、運営API用の共有シークレットを発行します。発行後の詳細画面に、インスタンスの起動コマンド（provision）が表示されます。
      </p>

      <Card>
        <CardHeader title="クライアント情報" />
        <form action={createClient} className="space-y-4 p-5">
          <FormField label="クライアント名" htmlFor="name" required>
            <Input id="name" name="name" placeholder="例：株式会社アクメ" required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="スラッグ（識別子・任意）" htmlFor="slug" hint="未入力なら名前から自動生成">
              <Input id="slug" name="slug" placeholder="acme" />
            </FormField>
            <FormField label="連絡先メール" htmlFor="contactEmail">
              <Input id="contactEmail" name="contactEmail" type="email" placeholder="owner@acme.co.jp" />
            </FormField>
            <FormField label="プラン" htmlFor="plan">
              <Select id="plan" name="plan" defaultValue="standard">
                {Object.values(PLANS).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}（¥{p.monthlyFee.toLocaleString()}/月・税込）
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="公開URL（baseUrl）" htmlFor="baseUrl" hint="デプロイ後の固定HTTPS。後で変更可">
              <Input id="baseUrl" name="baseUrl" placeholder="https://acme.example.com" />
            </FormField>
          </div>
          <FormField
            label="Stripe顧客ID（任意・cus_…）"
            htmlFor="stripeCustomerId"
            hint="申込時の支払いでStripeが採番した顧客ID。納品インスタンスの請求と紐づく（カード番号は保持しない）"
          >
            <Input id="stripeCustomerId" name="stripeCustomerId" placeholder="cus_xxxxxxxxxxxx" />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="紹介元（アフィリエイト・任意）" htmlFor="affiliateId" hint="選ぶと成約として紐づき、初回・月次の紹介報酬を計上">
              <Select id="affiliateId" name="affiliateId" defaultValue="">
                <option value="">なし（直販）</option>
                {affiliates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.code}）
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="サポートプラン" htmlFor="supportPlan" hint="月¥15,000のサポート契約あり（紹介報酬20%対象）">
              <label className="flex h-9 items-center gap-2 text-sm text-ink">
                <input type="checkbox" id="supportPlan" name="supportPlan" className="size-4" />
                契約あり
              </label>
            </FormField>
          </div>
          <FormField label="ホスティングのメモ（任意）" htmlFor="hostingNote">
            <Input id="hostingNote" name="hostingNote" placeholder="例：Render Starter / Tokyo" />
          </FormField>
          <FormField
            label="運営キー（任意）"
            htmlFor="operatorKey"
            hint="空なら自動生成。既にインスタンスがあり LCALL_OPERATOR_KEY が分かる場合は貼り付けて登録"
          >
            <Input id="operatorKey" name="operatorKey" placeholder="（自動生成）" />
          </FormField>
          <FormField label="メモ（任意）" htmlFor="notes">
            <Textarea id="notes" name="notes" placeholder="商談メモ・契約条件など" />
          </FormField>
          <div className="flex justify-end">
            <button type="submit" className={buttonClasses("gradient", "md")}>
              発行して台帳に登録
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
