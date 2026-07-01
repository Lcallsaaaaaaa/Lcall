import { Plus } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Badge, type BadgeTone } from "@/components/ui/StatusBadge";
import { deliveryProgress } from "@/config/delivery-steps";
import { listClients, type ClientRow } from "@/features/operator/queries";

const yen = (n: number) => `¥${n.toLocaleString()}`;
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString("ja-JP") : "—");

const CLIENT_STATUS: Record<ClientRow["client"]["status"], { tone: BadgeTone; label: string }> = {
  pending: { tone: "neutral", label: "決済待ち" },
  trial: { tone: "info", label: "トライアル" },
  active: { tone: "ok", label: "稼働中" },
  suspended: { tone: "warn", label: "停止中" },
  canceled: { tone: "neutral", label: "解約" },
};

const INSTANCE_TONE: Record<string, BadgeTone> = { up: "ok", down: "danger", unknown: "neutral" };

export default async function OperatorClientsPage() {
  const rows = await listClients();

  const columns: Column<ClientRow>[] = [
    {
      key: "name",
      header: "クライアント",
      render: (r) => (
        <Link href={`/operator/clients/${r.client.id}`} className="font-medium text-ink hover:text-brand">
          {r.client.name}
        </Link>
      ),
    },
    { key: "plan", header: "プラン", render: (r) => <span className="uppercase">{r.client.plan}</span> },
    {
      key: "status",
      header: "契約",
      render: (r) => {
        const s = CLIENT_STATUS[r.client.status];
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
    {
      key: "instance",
      header: "稼働",
      render: (r) => (
        <Badge tone={INSTANCE_TONE[r.instance?.status ?? "unknown"]}>{r.instance?.status ?? "未登録"}</Badge>
      ),
    },
    {
      key: "friends",
      header: "友だち",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.latest ? r.latest.totalFriends.toLocaleString() : "—"}</span>,
    },
    {
      key: "mrr",
      header: "MRR",
      align: "right",
      render: (r) => <span className="tabular-nums">{r.latest ? yen(r.latest.mrr ?? 0) : "—"}</span>,
    },
    {
      key: "delivery",
      header: "納品",
      render: (r) => {
        const p = deliveryProgress(r.client.deliverySteps);
        return p.delivered ? (
          <Badge tone="ok">納品済</Badge>
        ) : (
          <span className="text-xs text-muted tabular-nums">{p.doneRequired}/{p.totalRequired}</span>
        );
      },
    },
    { key: "lastSeen", header: "最終確認", render: (r) => <span className="text-muted">{fmtDate(r.instance?.lastSeenAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Link href={`/operator/clients/${r.client.id}`} className="text-sm font-medium text-brand hover:underline">
          詳細
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1100px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">クライアント台帳</h1>
          <p className="mt-1 text-sm text-muted">各クライアント（独立インスタンス）の一覧・稼働・規模。</p>
        </div>
        <Link href="/operator/clients/new" className={buttonClasses("gradient", "md")}>
          <Plus className="size-4" />
          新規発行
        </Link>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.client.id}
          empty="まだクライアントがありません。「新規発行」から登録してください。"
        />
      </Card>
    </div>
  );
}
