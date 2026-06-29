import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MAX_LINE_ACCOUNTS_FUTURE, PLANS } from "@/config/plans";
import {
  deleteLineAccount,
  toggleLineAccountStatus,
} from "@/features/line-accounts/actions";
import {
  activeLineCount,
  getCurrentPlan,
  getPlanLimit,
  listLineAccounts,
  type LineAccountWithCount,
} from "@/features/line-accounts/queries";

export default async function LineAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, accounts, limit, plan] = await Promise.all([
    searchParams,
    listLineAccounts(),
    getPlanLimit(),
    getCurrentPlan(),
  ]);
  const activeCount = activeLineCount(accounts);
  const atLimit = activeCount >= limit;

  const columns: Column<LineAccountWithCount>[] = [
    {
      key: "name",
      header: "アカウント",
      render: (a) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{a.name}</div>
          <div className="text-xs text-muted">ID: {a.channelId || "—"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "ステータス",
      render: (a) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={a.status} />
          <form action={toggleLineAccountStatus.bind(null, a.id)}>
            <button
              type="submit"
              className="rounded-md border border-line px-2 py-0.5 text-xs text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              {a.status === "paused" ? "再開" : "停止"}
            </button>
          </form>
        </div>
      ),
    },
    {
      key: "count",
      header: "登録 / 上限",
      render: (a) => {
        const ratio = a.capacity > 0 ? Math.min(1, a.friendCount / a.capacity) : 0;
        return (
          <div className="w-36">
            <div className="tabular-nums text-sm text-ink">
              {a.friendCount.toLocaleString()} / {a.capacity.toLocaleString()}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${ratio * 100}%`, backgroundColor: "#515bd4" }}
              />
            </div>
          </div>
        );
      },
    },
    { key: "weight", header: "比率", align: "right", render: (a) => <span className="tabular-nums">{a.weight}</span> },
    {
      key: "actions",
      header: "操作",
      align: "right",
      render: (a) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/line-accounts/${a.id}/edit`}
            className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
            title="編集"
          >
            <Pencil className="size-4" />
          </Link>
          <form action={deleteLineAccount.bind(null, a.id)}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger"
              title="削除"
            >
              <Trash2 className="size-4" />
            </button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">LINEアカウント</h1>
          <p className="mt-1 text-sm text-muted">
            複数のLINE公式アカウントを接続・管理します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted">
            {PLANS[plan].name}プラン · 有効 {activeCount} / {limit}
            <span className="text-faint"> （将来最大{MAX_LINE_ACCOUNTS_FUTURE}）</span>
          </span>
          {atLimit ? (
            <span
              className={buttonClasses("gradient", "md", "pointer-events-none opacity-50")}
              aria-disabled
            >
              <Plus className="size-4" />
              新規登録
            </span>
          ) : (
            <Link href="/line-accounts/new" className={buttonClasses("gradient", "md")}>
              <Plus className="size-4" />
              新規登録
            </Link>
          )}
        </div>
      </div>

      {error === "limit" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          <AlertTriangle className="size-4" />
          現在のプランの上限（{limit}個）に達しています。プランを変更すると追加できます。
        </div>
      )}

      <Card>
        <DataTable
          columns={columns}
          rows={accounts}
          getRowKey={(a) => a.id}
          empty="LINEアカウントがまだありません。「新規登録」から追加してください。"
        />
      </Card>
    </div>
  );
}
