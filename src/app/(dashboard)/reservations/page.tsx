import { CalendarClock, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { createReservationPage } from "@/features/reservations/actions";
import { listReservationPages } from "@/features/reservations/queries";
import { listLineAccounts } from "@/features/line-accounts/queries";

export default async function ReservationsPage() {
  const [pages, accounts] = await Promise.all([listReservationPages(), listLineAccounts()]);

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">予約表</h1>
        <p className="mt-1 text-sm text-muted">
          予約ページを作成し、LINEから友だちに予約してもらえます。作成時に「シンプル」か「メニュー型」を選べます。
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title="予約ページを作成" description="種類は後から変えられません。日時や定員は作成後に設定します。" />
        <form action={createReservationPage} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="名前" htmlFor="title" required className="min-w-48 flex-1">
            <Input id="title" name="title" placeholder="カウンセリング予約" required />
          </FormField>
          <FormField label="種類" htmlFor="type" required>
            <Select id="type" name="type" defaultValue="simple">
              <option value="simple">シンプル（日時枠のみ）</option>
              <option value="menu">メニュー型（メニューを選んで予約）</option>
            </Select>
          </FormField>
          <FormField label="対象の公式アカウント" htmlFor="lineAccountId" hint="友だち追加・通知に使用">
            <Select id="lineAccountId" name="lineAccountId" defaultValue="">
              <option value="">共通（全アカウント）</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="予約ページ一覧" description={`${pages.length}件`} />
        {pages.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted">
            <CalendarClock className="size-4" /> まだありません。
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/reservations/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-surface-2/60">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{p.title}</span>
                      <Badge tone={p.type === "menu" ? "info" : "neutral"}>
                        {p.type === "menu" ? "メニュー型" : "シンプル"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {p.type === "menu" && `メニュー${p.menuCount}件・`}今後の予約 {p.upcomingCount}件
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
