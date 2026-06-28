import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { FormField, Input } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { createScenario, deleteScenario } from "@/features/scenarios/actions";
import { listScenarios, type ScenarioRow } from "@/features/scenarios/queries";

export default async function ScenariosPage() {
  const scenarios = await listScenarios();

  const columns: Column<ScenarioRow>[] = [
    {
      key: "name",
      header: "シナリオ",
      render: (s) => (
        <Link href={`/scenarios/${s.id}`} className="font-medium text-ink hover:text-brand">
          {s.name}
        </Link>
      ),
    },
    {
      key: "status",
      header: "状態",
      render: (s) =>
        s.status === "active" ? <Badge tone="ok">稼働中</Badge> : <Badge tone="neutral">停止中</Badge>,
    },
    { key: "stepCount", header: "ステップ", align: "right", render: (s) => <span className="tabular-nums">{s.stepCount}</span> },
    { key: "deliveryCount", header: "配信実績", align: "right", render: (s) => <span className="tabular-nums">{s.deliveryCount.toLocaleString()}</span> },
    {
      key: "target",
      header: "対象タグ",
      render: (s) => (s.targetTagName ? <Badge tone="info">{s.targetTagName}</Badge> : <span className="text-faint">全員</span>),
    },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (s) => (
        <form action={deleteScenario.bind(null, s.id)}>
          <button type="submit" className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger" title="削除">
            <Trash2 className="size-4" />
          </button>
        </form>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">シナリオ配信</h1>
        <p className="mt-1 text-sm text-muted">
          友だち追加時の挨拶や、登録からの経過時間に応じたステップ配信を設定します（タグで出し分け）。
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title="シナリオを作成" />
        <form action={createScenario} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="シナリオ名" htmlFor="name" required className="min-w-48 flex-1">
            <Input id="name" name="name" placeholder="新規フォロー育成シナリオ" required />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成
          </Button>
        </form>
      </Card>

      <Card>
        <DataTable columns={columns} rows={scenarios} getRowKey={(s) => s.id} empty="シナリオがまだありません。" />
      </Card>
    </div>
  );
}
