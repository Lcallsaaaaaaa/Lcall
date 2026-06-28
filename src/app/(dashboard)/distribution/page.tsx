import { Link2, Play, Shuffle } from "lucide-react";
import { headers } from "next/headers";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Badge, StatusBadge } from "@/components/ui/StatusBadge";
import { setStrategy, simulateDistribution } from "@/features/distribution/actions";
import { eligibleCandidates } from "@/features/distribution/engine";
import {
  getCandidates,
  getStrategy,
  listDistributionLogs,
  type DistributionLogRow,
  type NamedCandidate,
} from "@/features/distribution/queries";
import type { DistributionStrategy } from "@/lib/data/types";

const STRATEGY_LABEL: Record<DistributionStrategy, string> = {
  random: "ランダム分散",
  even: "均等分散",
  weighted: "重み付き分散",
};

const STRATEGY_OPTIONS: { value: DistributionStrategy; title: string; desc: string }[] = [
  { value: "random", title: "ランダム分散", desc: "対象のLINEへ完全ランダムに割り当て" },
  { value: "even", title: "均等分散", desc: "登録数がもっとも少ないLINEへ割り当て" },
  { value: "weighted", title: "重み付き分散", desc: "各LINEの「比率（重み）」に応じて割り当て" },
];

export default async function DistributionPage() {
  const [strategy, candidates, logs, h] = await Promise.all([
    getStrategy(),
    getCandidates(),
    listDistributionLogs(20),
    headers(),
  ]);

  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const commonUrl = `${proto}://${host}/api/distribute`;

  const eligibleIds = new Set(eligibleCandidates(candidates).map((c) => c.id));

  const logColumns: Column<DistributionLogRow>[] = [
    {
      key: "createdAt",
      header: "日時",
      render: (l) => (
        <span className="tabular-nums text-muted">
          {new Date(l.createdAt).toLocaleString("ja-JP")}
        </span>
      ),
    },
    { key: "accountName", header: "割り当て先", render: (l) => <span className="text-ink">{l.accountName}</span> },
    {
      key: "strategy",
      header: "方式",
      render: (l) => <Badge tone="info">{STRATEGY_LABEL[l.strategy]}</Badge>,
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">分散登録URL</h1>
        <p className="mt-1 text-sm text-muted">
          1つの共通URLから複数のLINEへ自動で振り分けます。停止中・上限到達のLINEは自動的に除外されます。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* 共通登録URL */}
          <Card>
            <CardHeader title="共通登録URL" description="この1本をLP・広告・QRに設置します" />
            <div className="p-5">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                <Link2 className="size-4 shrink-0 text-muted" />
                <code className="truncate text-sm text-ink">{commonUrl}</code>
              </div>
              <p className="mt-2 text-xs text-muted">
                アクセスすると現在の方式でLINEを選び、その友だち追加URLへリダイレクトします。
              </p>
            </div>
          </Card>

          {/* 振り分け方式 */}
          <Card>
            <CardHeader title="振り分け方式" />
            <form action={setStrategy} className="p-5">
              <fieldset className="space-y-2.5">
                {STRATEGY_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-surface-2"
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={o.value}
                      defaultChecked={strategy === o.value}
                      className="mt-0.5 accent-[#dd2a7b]"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{o.title}</span>
                      <span className="block text-xs text-muted">{o.desc}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="mt-4 flex items-center gap-2">
                <Button type="submit" variant="solid" size="md">
                  <Shuffle className="size-4" />
                  方式を保存
                </Button>
                <span className="text-xs text-muted">
                  現在: {STRATEGY_LABEL[strategy]}
                </span>
              </div>
            </form>
          </Card>

          {/* 振り分けログ */}
          <Card>
            <CardHeader title="振り分けログ" description="どのLINEへ割り当てたかの記録" />
            <DataTable
              columns={logColumns}
              rows={logs}
              getRowKey={(l) => l.id}
              empty="まだ振り分け実績がありません。右の「テスト振り分け」で動作を確認できます。"
            />
          </Card>
        </div>

        {/* 右カラム: 対象状況 + テスト */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="振り分け対象" description="除外条件: 停止中 / 凍結 / 上限到達" />
            <div className="space-y-3 p-5">
              {candidates.map((c: NamedCandidate) => {
                const eligible = eligibleIds.has(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-muted">
                        {c.count.toLocaleString()} / {c.capacity.toLocaleString()} · 重み {c.weight}
                      </div>
                    </div>
                    {eligible ? (
                      <Badge tone="ok">対象</Badge>
                    ) : (
                      <div className="flex items-center gap-1">
                        <StatusBadge status={c.status} />
                        <Badge tone="neutral">除外</Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card accentRail>
            <CardHeader title="テスト振り分け" description="LINEへは飛ばさず記録のみ" />
            <div className="p-5">
              <form action={simulateDistribution}>
                <Button type="submit" variant="gradient" size="md" className="w-full">
                  <Play className="size-4" />
                  1件 振り分けを試す
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted">
                押すたびに現在の方式で1件割り当て、左下のログに記録します。
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
