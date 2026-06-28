import { Plus } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { Badge, BroadcastStatusBadge } from "@/components/ui/StatusBadge";
import { createFromTemplate } from "@/features/broadcasts/actions";
import { BROADCAST_TYPE_LABEL } from "@/features/broadcasts/labels";
import { listBroadcasts, listTemplates, type BroadcastRow } from "@/features/broadcasts/queries";

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString("ja-JP") : "—");

export default async function BroadcastsPage() {
  const [allBroadcasts, allTemplates] = await Promise.all([listBroadcasts(), listTemplates()]);
  // カルーセルは「カルーセル」画面で管理するため、配信一覧には出さない
  const broadcasts = allBroadcasts.filter((b) => b.type !== "carousel");
  const templates = allTemplates.filter((t) => t.type !== "carousel");

  const columns: Column<BroadcastRow>[] = [
    {
      key: "title",
      header: "配信",
      render: (b) => (
        <Link href={`/broadcasts/${b.id}`} className="font-medium text-ink hover:text-brand">
          {b.title}
        </Link>
      ),
    },
    {
      key: "type",
      header: "種別",
      render: (b) => (
        <span className="text-muted">
          {BROADCAST_TYPE_LABEL[b.type]}
          {b.type === "carousel" && <span className="text-faint">（{b.cardCount}枚）</span>}
        </span>
      ),
    },
    { key: "status", header: "状態", render: (b) => <BroadcastStatusBadge status={b.status} /> },
    {
      key: "target",
      header: "対象",
      render: (b) =>
        b.targetTagNames.length ? (
          <span className="text-muted">{b.targetTagNames.join(" / ")}</span>
        ) : (
          <span className="text-faint">全員</span>
        ),
    },
    {
      key: "sentCount",
      header: "送信数",
      align: "right",
      render: (b) => <span className="tabular-nums">{b.sentCount.toLocaleString()}</span>,
    },
    {
      key: "when",
      header: "送信/予約",
      render: (b) => <span className="text-muted">{fmtDate(b.sentAt ?? b.scheduledAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (b) => (
        <Link href={`/broadcasts/${b.id}`} className="text-sm font-medium text-brand hover:underline">
          詳細
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">配信管理</h1>
          <p className="mt-1 text-sm text-muted">
            テキスト・URL付きの配信を作成・送信・履歴管理します。（カルーセルは「カルーセル」画面で管理）
          </p>
        </div>
        <Link href="/broadcasts/new" className={buttonClasses("gradient", "md")}>
          <Plus className="size-4" />
          新規作成
        </Link>
      </div>

      <Card className="mb-5">
        <DataTable
          columns={columns}
          rows={broadcasts}
          getRowKey={(b) => b.id}
          empty="配信がまだありません。「新規作成」から作成してください。"
        />
      </Card>

      {templates.length > 0 && (
        <Card>
          <CardHeader title="テンプレート" description="保存した配信内容から新規作成できます。" />
          <ul className="divide-y divide-line">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <span className="font-medium text-ink">{t.name}</span>
                  <Badge tone="neutral" className="ml-2">
                    {BROADCAST_TYPE_LABEL[t.type]}
                  </Badge>
                </div>
                <form action={createFromTemplate.bind(null, t.id)}>
                  <button type="submit" className={buttonClasses("outline", "sm")}>
                    この内容で作成
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
