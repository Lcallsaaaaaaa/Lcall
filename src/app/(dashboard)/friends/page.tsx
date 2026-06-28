import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Column, DataTable } from "@/components/ui/DataTable";
import { FriendStatusBadge } from "@/components/ui/StatusBadge";
import { TagChip } from "@/components/ui/TagChip";
import { Input, Select } from "@/components/ui/Form";
import { listFriends, type FriendRow } from "@/features/friends/queries";
import { listLineAccounts } from "@/features/line-accounts/queries";
import { listTags } from "@/features/tags/queries";

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("ja-JP") : "—");

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tagId?: string; lineAccountId?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const tagId = sp.tagId ?? "";
  const lineAccountId = sp.lineAccountId ?? "";
  const page = Number(sp.page) || 1;

  const [result, tags, accounts] = await Promise.all([
    listFriends({ q, tagId, lineAccountId, page }),
    listTags(),
    listLineAccounts(),
  ]);

  const makePageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tagId) params.set("tagId", tagId);
    if (lineAccountId) params.set("lineAccountId", lineAccountId);
    params.set("page", String(p));
    return `/friends?${params.toString()}`;
  };

  const columns: Column<FriendRow>[] = [
    {
      key: "displayName",
      header: "顧客",
      render: (f) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{f.displayName}</div>
          <div className="text-xs text-muted">{f.lineUserId}</div>
        </div>
      ),
    },
    { key: "lineAccountName", header: "登録LINE", render: (f) => <span className="text-ink">{f.lineAccountName}</span> },
    { key: "registeredAt", header: "登録日時", render: (f) => <span className="text-muted">{fmtDate(f.registeredAt)}</span> },
    {
      key: "tags",
      header: "タグ",
      render: (f) =>
        f.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {f.tags.map((t) => (
              <TagChip key={t.id} name={t.name} color={t.color} />
            ))}
          </div>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    { key: "lastClickAt", header: "最終クリック", render: (f) => <span className="text-muted">{fmtDate(f.lastClickAt)}</span> },
    {
      key: "responses",
      header: "回答(フォーム/アンケート)",
      align: "right",
      render: (f) => (
        <span className="tabular-nums text-muted">
          {f.formCount} / {f.surveyCount}
        </span>
      ),
    },
    {
      key: "ltv",
      header: "LTV",
      align: "right",
      render: (f) => <span className="tabular-nums text-ink">¥{f.ltv.toLocaleString()}</span>,
    },
    { key: "status", header: "ステータス", render: (f) => <FriendStatusBadge status={f.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (f) => (
        <Link href={`/friends/${f.id}`} className="text-sm font-medium text-brand hover:underline">
          詳細
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">顧客管理</h1>
          <p className="mt-1 text-sm text-muted">登録された友だち（顧客）の一覧と詳細。</p>
        </div>
        <a href="/api/export/friends" className={buttonClasses("outline", "md")}>
          <Download className="size-4" />
          CSV出力
        </a>
      </div>

      {/* 絞り込み */}
      <Card className="mb-4">
        <form method="get" action="/friends" className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-52 flex-1">
            <label className="mb-1.5 block text-sm font-medium text-ink">検索</label>
            <Input name="q" defaultValue={q} placeholder="表示名 / LINEユーザーID" />
          </div>
          <div className="w-44">
            <label className="mb-1.5 block text-sm font-medium text-ink">タグ</label>
            <Select name="tagId" defaultValue={tagId}>
              <option value="">すべて</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <label className="mb-1.5 block text-sm font-medium text-ink">登録LINE</label>
            <Select name="lineAccountId" defaultValue={lineAccountId}>
              <option value="">すべて</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonClasses("solid", "md")}>
            <Search className="size-4" />
            絞り込み
          </button>
          {(q || tagId || lineAccountId) && (
            <Link href="/friends" className={buttonClasses("ghost", "md")}>
              クリア
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <DataTable columns={columns} rows={result.rows} getRowKey={(f) => f.id} empty="該当する顧客がいません。" />
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-muted">
          <span>
            全 {result.total.toLocaleString()} 件中 {(result.page - 1) * result.pageSize + 1}–
            {Math.min(result.page * result.pageSize, result.total)} 件
          </span>
          <span className="flex items-center gap-1">
            {result.page > 1 ? (
              <Link href={makePageHref(result.page - 1)} className="rounded-md p-1.5 hover:bg-surface-2 hover:text-ink" aria-label="前へ">
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-faint"><ChevronLeft className="size-4" /></span>
            )}
            <span className="tabular-nums">
              {result.page} / {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link href={makePageHref(result.page + 1)} className="rounded-md p-1.5 hover:bg-surface-2 hover:text-ink" aria-label="次へ">
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-faint"><ChevronRight className="size-4" /></span>
            )}
          </span>
        </div>
      </Card>
    </div>
  );
}
