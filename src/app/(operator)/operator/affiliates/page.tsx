import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { AFFILIATE_RANKS, PLANS, PRICING } from "@/config/plans";
import {
  accrueCommissions,
  createAffiliate,
  regenerateAffiliateToken,
  setAffiliateStatus,
  setCommissionStatus,
} from "@/features/operator/actions";
import {
  currentPeriodMonth,
  listAffiliateRows,
  listCommissionRows,
  signupCommissionAmount,
} from "@/features/operator/affiliate";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const KIND: Record<string, string> = { signup: "初回", recurring: "月次" };
const CSTAT: Record<string, { tone: "neutral" | "info" | "ok"; label: string }> = {
  pending: { tone: "neutral", label: "未承認" },
  approved: { tone: "info", label: "承認済" },
  paid: { tone: "ok", label: "支払済" },
};

export default async function OperatorAffiliatesPage() {
  const [rows, commissions] = await Promise.all([listAffiliateRows(), listCommissionRows()]);
  const period = currentPeriodMonth();
  // 紹介リンクの土台（コントロールプレーンの公開URL）。未設定なら相対パスで案内。
  const signupBase = (process.env.LCALL_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  // 代理店（上位に選べる）＝rank=agency かつ active。
  const agencies = rows.map((r) => r.affiliate).filter((a) => a.rank === "agency" && a.status === "active");
  const pct = (n?: number) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");
  const RANK_LABEL: Record<string, string> = { agency: "代理店", member: "一般" };

  return (
    <div className="mx-auto max-w-[960px] p-6 lg:p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">アフィリエイト</h1>
      <p className="mb-6 text-sm text-muted">
        報酬＝初回（初期費×率）＋月次（月額×率）。**代理店方式**：代理店(A)＝初回{Math.round(AFFILIATE_RANKS.agency.signupRate * 100)}%/継続{Math.round(AFFILIATE_RANKS.agency.recurringRate * 100)}%（＝ネットワーク上限）。配下(B)はA率以内で設定でき、Bの成約時は「A率−B率」がAへオーバーライド（合計は常にA率以内＝薄利保護）。ランク未設定は従来（初回{Math.round(PRICING.affiliateSetupRate * 100)}%・月次はプラン準拠）。
      </p>

      <Card className="mb-5">
        <CardHeader title="紹介者を登録" />
        <form action={createAffiliate} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <FormField label="名前" htmlFor="name" required>
            <Input id="name" name="name" required placeholder="例：山田パートナー" />
          </FormField>
          <FormField label="メール" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="partner@example.com" />
          </FormField>
          <FormField label="紹介コード（任意）" htmlFor="code" hint="未入力なら自動生成・一意化">
            <Input id="code" name="code" placeholder="yamada" />
          </FormField>
          <FormField label="ランク" htmlFor="rank" hint="代理店＝上位（上限率）／一般＝通常。配下にもできる">
            <Select id="rank" name="rank" defaultValue="member">
              <option value="member">一般</option>
              <option value="agency">代理店</option>
            </Select>
          </FormField>
          <FormField label="上位（代理店）" htmlFor="parentAffiliateId" hint="配下にする場合に選択。成約でこの代理店へオーバーライド">
            <Select id="parentAffiliateId" name="parentAffiliateId" defaultValue="">
              <option value="">なし（独立）</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}（{a.code}）
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="初回報酬率（％・任意）"
            htmlFor="signupRate"
            hint={`未入力はランク既定。上限＝代理店率${Math.round(AFFILIATE_RANKS.agency.signupRate * 100)}%（上位選択時はその率が上限）`}
          >
            <Input id="signupRate" name="signupRate" type="number" min="0" max="100" placeholder="例：20" />
          </FormField>
          <FormField
            label="継続報酬率（％・任意）"
            htmlFor="recurringRate"
            hint={`未入力はランク既定。上限＝代理店率${Math.round(AFFILIATE_RANKS.agency.recurringRate * 100)}%`}
          >
            <Input id="recurringRate" name="recurringRate" type="number" min="0" max="100" placeholder="例：20" />
          </FormField>
          <FormField label="支払先メモ（任意）" htmlFor="payoutNote">
            <Input id="payoutNote" name="payoutNote" placeholder="銀行口座など" />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" variant="gradient" size="md">
              <Plus className="size-4" />
              登録
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="紹介者一覧"
          description="クライアントは発行時に「紹介元」を選ぶと紐づきます。"
          action={
            <form action={accrueCommissions} className="flex items-end gap-2">
              <input type="hidden" name="periodMonth" value={period} />
              <Button type="submit" variant="outline" size="sm">{period} 分を月次計上</Button>
            </form>
          }
        />
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">まだ紹介者がいません。</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ affiliate: a, parentName, activeClients, monthlyShare, pending, approved, paid }) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5">
                <div className="min-w-[180px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{a.name}</span>
                    {a.rank && <Badge tone={a.rank === "agency" ? "info" : "neutral"}>{RANK_LABEL[a.rank]}</Badge>}
                    <Badge tone={a.status === "active" ? "ok" : "neutral"}>
                      {a.status === "active" ? "有効" : "停止"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">コード: <code>{a.code}</code></p>
                  <p className="text-xs text-muted">
                    率: 初回 {pct(a.signupRate)} ／ 継続 {pct(a.recurringRate)}
                    {parentName && <> ／ 上位: {parentName}</>}
                  </p>
                  <p className="mt-0.5 break-all text-xs text-muted">
                    申込リンク: <code className="text-brand">{`${signupBase}/signup?aff=${a.code}`}</code>
                  </p>
                  {a.portalToken ? (
                    <p className="mt-0.5 break-all text-xs text-muted">
                      報酬確認: <code className="text-brand">{`${signupBase}/aff/${a.portalToken}`}</code>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-faint">報酬確認リンク未発行（右の「確認リンク発行」）</p>
                  )}
                </div>
                <div className="text-sm text-muted">
                  稼働{activeClients}社 ／ 月次見込 <span className="font-medium text-ink">{yen(monthlyShare)}</span>
                </div>
                <div className="text-sm text-muted">
                  未承認 {yen(pending)} ／ 承認 {yen(approved)} ／ 支払済 {yen(paid)}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <form action={regenerateAffiliateToken.bind(null, a.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      {a.portalToken ? "確認リンク再発行" : "確認リンク発行"}
                    </Button>
                  </form>
                  <form action={setAffiliateStatus.bind(null, a.id, a.status === "active" ? "suspended" : "active")}>
                    <Button type="submit" variant="ghost" size="sm">
                      {a.status === "active" ? "停止" : "有効化"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="報酬一覧" description="月次計上後、承認→支払い済みに進めます。" />
        {commissions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">まだ報酬がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">
                  <th className="px-4 py-2">紹介者</th>
                  <th className="px-4 py-2">クライアント</th>
                  <th className="px-4 py-2">種別</th>
                  <th className="px-4 py-2">対象月</th>
                  <th className="px-4 py-2 text-right">金額</th>
                  <th className="px-4 py-2">状態</th>
                  <th className="px-4 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map(({ commission: c, affiliateName, clientName }) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-ink">{affiliateName}</td>
                    <td className="px-4 py-2 text-muted">{clientName}</td>
                    <td className="px-4 py-2">{KIND[c.kind] ?? c.kind}</td>
                    <td className="px-4 py-2 text-muted">{c.periodMonth ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink">{yen(c.amount)}</td>
                    <td className="px-4 py-2"><Badge tone={CSTAT[c.status].tone}>{CSTAT[c.status].label}</Badge></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {c.status === "pending" && (
                          <form action={setCommissionStatus.bind(null, c.id, "approved")}>
                            <Button type="submit" variant="ghost" size="sm">承認</Button>
                          </form>
                        )}
                        {c.status === "approved" && (
                          <form action={setCommissionStatus.bind(null, c.id, "paid")}>
                            <Button type="submit" variant="ghost" size="sm">支払済に</Button>
                          </form>
                        )}
                      </div>
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
