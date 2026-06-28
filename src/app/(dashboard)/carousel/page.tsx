import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { FormField, Input } from "@/components/ui/Form";
import { BroadcastStatusBadge } from "@/components/ui/StatusBadge";
import { createCarousel } from "@/features/broadcasts/actions";
import { listBroadcasts, type BroadcastRow } from "@/features/broadcasts/queries";

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString("ja-JP") : "—");

export default async function CarouselPage() {
  const rows = (await listBroadcasts()).filter((b) => b.type === "carousel");

  const columns: Column<BroadcastRow>[] = [
    {
      key: "title",
      header: "カルーセル配信",
      render: (b) => (
        <Link href={`/carousel/${b.id}`} className="font-medium text-ink hover:text-brand">
          {b.title}
        </Link>
      ),
    },
    {
      key: "cardCount",
      header: "カード数",
      align: "right",
      render: (b) => <span className="tabular-nums">{b.cardCount}</span>,
    },
    { key: "status", header: "状態", render: (b) => <BroadcastStatusBadge status={b.status} /> },
    {
      key: "sentCount",
      header: "送信数",
      align: "right",
      render: (b) => <span className="tabular-nums">{b.sentCount.toLocaleString()}</span>,
    },
    { key: "when", header: "送信/予約", render: (b) => <span className="text-muted">{fmtDate(b.sentAt ?? b.scheduledAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (b) => (
        <Link href={`/carousel/${b.id}`} className="text-sm font-medium text-brand hover:underline">
          編集
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1100px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">カルーセル</h1>
        <p className="mt-1 text-sm text-muted">
          横スワイプの複数カード型メッセージを作成・管理します。作成だけでは配信されません（送信は詳細画面から明示的に行います）。カードのボタンは計測URLを経由します。
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title="新規カルーセルを作成" description="まず名前を付けて作成 → 次の画面でカードを追加します。" />
        <form action={createCarousel} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="カルーセル名（管理用）" htmlFor="title" className="flex-1" required>
            <Input id="title" name="title" placeholder="例：サービス紹介カルーセル" required />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成してカード追加へ
          </Button>
        </form>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(b) => b.id}
          empty="まだカルーセルがありません。上の「新規カルーセルを作成」から作成してください。"
        />
      </Card>
    </div>
  );
}
