import { LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { listRichMenus } from "@/features/rich-menus/queries";

export default async function RichMenusPage() {
  const menus = await listRichMenus();

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">リッチメニュー</h1>
          <p className="mt-1 text-sm text-muted">
            LINEトーク画面の下部に表示する固定メニュー。テンプレートから作り、実LINEへ反映できます。
          </p>
        </div>
        <Link href="/rich-menus/new" className={buttonClasses("gradient", "md")}>
          <Plus className="size-4" />
          新規作成
        </Link>
      </div>

      {menus.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface p-12 text-center">
          <LayoutGrid className="mx-auto mb-3 size-8 text-faint" />
          <p className="text-sm text-muted">まだリッチメニューがありません。</p>
          <Link href="/rich-menus/new" className={`mt-4 ${buttonClasses("gradient", "md")}`}>
            <Plus className="size-4" />
            最初のメニューを作成
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">LINEアカウント</th>
                <th className="px-4 py-3 font-medium">レイアウト</th>
                <th className="px-4 py-3 font-medium">反映先</th>
                <th className="px-4 py-3 font-medium">状態</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {menus.map((m) => (
                <tr key={m.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{m.name}</div>
                    <div className="text-xs text-faint">メニューバー: {m.chatBarText}・ボタン{m.buttonCount}個</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{m.accountName}</td>
                  <td className="px-4 py-3 text-muted">{m.templateLabel}</td>
                  <td className="px-4 py-3">
                    {m.isDefault ? (
                      <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-medium text-neutral">既定（全員）</span>
                    ) : (
                      <span className="rounded-full bg-[#fdf2f8] px-2 py-0.5 text-xs font-medium text-brand">タグ: {m.tagName ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.lineRichMenuId ? (
                      <span className="rounded-full bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok">反映済み</span>
                    ) : (
                      <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">下書き</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/rich-menus/${m.id}/edit`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
