import { Activity, AlertTriangle, Server, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { aggregateFleet, listClients } from "@/features/operator/queries";

const yen = (n: number) => `¥${n.toLocaleString()}`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export default async function OperatorDashboardPage() {
  const [s, rows] = await Promise.all([aggregateFleet(), listClients()]);

  return (
    <div className="mx-auto max-w-[1100px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">運営ダッシュボード</h1>
          <p className="mt-1 text-sm text-muted">全クライアントの稼働・規模・収益を横断で把握します。</p>
        </div>
        <Link href="/operator/clients" className="text-sm font-medium text-brand hover:underline">
          クライアント一覧へ →
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="クライアント数" value={s.totalClients.toLocaleString()} sub={`稼働中 ${s.active} / 停止 ${s.suspended} / 納品済 ${s.delivered}`} />
        <Stat label="MRR（月次経常収益）" value={yen(s.totalMrr)} sub={s.pastDue > 0 ? `支払延滞 ${s.pastDue}件` : "延滞なし"} />
        <Stat label="総友だち数" value={s.totalFriends.toLocaleString()} sub={`総配信 ${s.totalDeliveries.toLocaleString()} 通`} />
        <Stat label="インスタンス稼働" value={`${s.instancesUp} / ${s.totalClients}`} sub={`down ${s.instancesDown} / 未確認 ${s.instancesUnknown}`} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="総クリック" value={s.totalClicks.toLocaleString()} />
        <div className="col-span-1 flex items-center gap-2 rounded-xl border border-line bg-surface p-5 text-sm text-muted lg:col-span-3">
          {s.instancesDown > 0 ? (
            <>
              <AlertTriangle className="size-4 text-danger" />
              <span className="text-ink">{s.instancesDown}件のインスタンスが応答していません。</span>
              <Link href="/operator/clients" className="ml-auto font-medium text-brand hover:underline">確認する</Link>
            </>
          ) : (
            <>
              <Activity className="size-4 text-ok" />
              <span>確認済みインスタンスはすべて応答しています（未確認は各詳細で「今すぐ確認」）。</span>
            </>
          )}
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Server className="size-4 text-muted" />
          <h2 className="text-[15px] font-semibold text-ink">最近のクライアント</h2>
          <Link href="/operator/clients" className="ml-auto text-sm text-brand hover:underline">すべて</Link>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted">
            <Users className="mx-auto mb-2 size-6 text-faint" />
            まだクライアントがありません。<Link href="/operator/clients/new" className="font-medium text-brand hover:underline">新規発行</Link>から登録してください。
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.slice(0, 8).map(({ client, instance, latest }) => (
              <li key={client.id} className="flex items-center gap-3 px-5 py-3">
                <Link href={`/operator/clients/${client.id}`} className="font-medium text-ink hover:text-brand">
                  {client.name}
                </Link>
                <span className="text-xs text-muted">{client.plan}</span>
                <span className="ml-auto text-xs text-muted">
                  {latest ? `友だち ${latest.totalFriends.toLocaleString()} / MRR ${yen(latest.mrr ?? 0)}` : "未確認"}
                </span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] " +
                    (instance?.status === "up"
                      ? "bg-ok-bg text-ok"
                      : instance?.status === "down"
                        ? "bg-danger-bg text-danger"
                        : "bg-neutral-bg text-neutral")
                  }
                >
                  {instance?.status ?? "unknown"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
