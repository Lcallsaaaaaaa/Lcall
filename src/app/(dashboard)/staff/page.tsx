import { Plus, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { PLANS } from "@/config/plans";
import { getCurrentPlan } from "@/features/line-accounts/queries";
import { createStaff, deleteStaff, updateStaff } from "@/features/users/actions";
import { listUsers } from "@/features/users/queries";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";

const NOTICES: Record<string, { tone: "ok" | "danger"; text: string }> = {
  created: { tone: "ok", text: "スタッフを追加しました。" },
  updated: { tone: "ok", text: "更新しました。" },
  deleted: { tone: "ok", text: "削除しました。" },
};
const ERRORS: Record<string, string> = {
  missing: "メールアドレスと初期パスワードは必須です。",
  dup: "そのメールアドレスは既に登録されています。",
  limit: "スタッフ数の上限に達しています。追加するには既存スタッフを削除してください。",
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString("ja-JP");

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const [users, plan] = await Promise.all([listUsers(), getCurrentPlan()]);
  const staffLimit = PLANS[plan].staffLimit;
  const atLimit = users.length >= staffLimit;
  const notice = sp.ok ? NOTICES[sp.ok] : sp.error ? { tone: "danger" as const, text: ERRORS[sp.error] ?? "エラー" } : null;

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">スタッフ管理</h1>
        <p className="mt-1 text-sm text-muted">
          メール＋パスワードでログインできるスタッフを追加し、役割で閲覧範囲を制限します。
        </p>
      </div>

      {notice && (
        <div
          className={`mb-5 rounded-lg px-4 py-3 text-sm ${
            notice.tone === "ok" ? "bg-ok-bg text-ok" : "bg-danger-bg text-danger"
          }`}
        >
          {notice.text}
        </div>
      )}

      <Card className="mb-5">
        <CardHeader
          title="役割と閲覧範囲"
          description="オーナー＝全部（分析・契約/請求・スタッフ管理）／運用担当＝配信・LINE設定・テンプレ等（分析/お金は不可）／チャット対応＝チャット・顧客・テンプレ・タグのみ"
        />
      </Card>

      <Card className="mb-5">
        <CardHeader title="スタッフを追加" description={`${users.length} / ${staffLimit} 名（${PLANS[plan].name}プラン）`} />
        {atLimit ? (
          <p className="px-5 py-4 text-sm text-muted">
            スタッフ数の上限（{staffLimit}名）に達しています。追加するには既存スタッフを削除するか、上位プランへの変更をご検討ください。
          </p>
        ) : (
        <form action={createStaff} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <FormField label="メールアドレス" htmlFor="email" required>
            <Input id="email" name="email" type="email" required placeholder="staff@example.com" />
          </FormField>
          <FormField label="表示名" htmlFor="name">
            <Input id="name" name="name" placeholder="担当者名" />
          </FormField>
          <FormField label="役割" htmlFor="role" required>
            <Select id="role" name="role" defaultValue="staff">
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="初期パスワード" htmlFor="password" required>
            <Input id="password" name="password" type="text" required placeholder="本人へ安全に共有" />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" variant="gradient" size="md">
              <Plus className="size-4" />
              追加
            </Button>
          </div>
        </form>
        )}
      </Card>

      <Card>
        <CardHeader title="登録スタッフ" description={`${users.length} / ${staffLimit} 名（ログイン可能なアカウント・初期オーナーは別枠）`} />
        {users.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted">
            <UserCog className="size-4" /> まだスタッフがいません。
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-medium text-ink">{u.name}</span>
                  <Badge tone="neutral">{ROLE_LABELS[u.role]}</Badge>
                  {!u.passwordHash && <Badge tone="warn">パスワード未設定</Badge>}
                  <span className="ml-auto text-xs text-faint">{fmtDate(u.createdAt)}</span>
                </div>
                <p className="mb-3 text-sm text-muted">{u.email}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <form action={updateStaff.bind(null, u.id)} className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted">表示名</label>
                      <Input name="name" defaultValue={u.name} className="h-9" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">役割</label>
                      <Select name="role" defaultValue={u.role} className="h-9">
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">新パスワード（任意）</label>
                      <Input name="password" type="text" placeholder="変更時のみ" className="h-9" />
                    </div>
                    <Button type="submit" variant="outline" size="sm">
                      更新
                    </Button>
                  </form>
                  <form action={deleteStaff.bind(null, u.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs text-danger transition hover:bg-danger-bg"
                    >
                      <Trash2 className="size-3.5" />
                      削除
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-faint">
        ※ 初期オーナー（環境変数 LCALL_ADMIN_EMAIL）はこの一覧には表示されません。常にログインできます。
      </p>
    </div>
  );
}
