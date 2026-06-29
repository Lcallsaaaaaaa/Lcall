import { Link2, Megaphone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Form";
import { createAdCode, deleteAdCode } from "@/features/ad-codes/actions";
import { listAdCodes } from "@/features/ad-codes/queries";
import { publicBaseUrl } from "@/lib/url";

export default async function AdCodesPage() {
  const [codes, base] = await Promise.all([listAdCodes(), publicBaseUrl()]);
  const regUrl = (code: string) => `${base}/api/distribute?ad=${encodeURIComponent(code)}`;
  // 広告出稿用URL（タグ計測付き）。媒体の遷移先にこれを使うと Pixel/gtag が発火し、
  // gclid/fbclid を捕捉 → 友だち追加時に Meta/Google へコンバージョン送信する。
  const adUrl = (code: string) => `${base}/j?ad=${encodeURIComponent(code)}`;

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">広告コード（流入元）</h1>
        <p className="mt-1 text-sm text-muted">
          広告ごとにコードを発行し、その登録URLから登録した友だちに流入元を記録します。チャットのプロフィールで確認できます。
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title="広告コードを発行" />
        <form action={createAdCode} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="広告名（ラベル）" htmlFor="label" required className="min-w-40 flex-1">
            <Input id="label" name="label" placeholder="春キャンペーン" required />
          </FormField>
          <FormField label="コード（任意）" htmlFor="code" hint="未入力ならラベルから自動生成">
            <Input id="code" name="code" placeholder="spring" />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            発行
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="発行済みの広告コード" description={`${codes.length}件`} />
        {codes.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted">
            <Megaphone className="size-4" /> まだありません。
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {codes.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{c.label}</span>
                    <code className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">{c.code}</code>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm text-muted">登録 {c.friendCount.toLocaleString()}人</span>
                    <form action={deleteAdCode.bind(null, c.id)}>
                      <button type="submit" className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger" title="削除">
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-muted">登録URL（通常）</p>
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <Link2 className="size-3.5 shrink-0 text-muted" />
                    <code className="truncate text-xs text-ink">{regUrl(c.code)}</code>
                  </div>
                  <p className="pt-1 text-xs text-muted">
                    広告出稿用URL（Meta/Googleタグ計測付き）— 媒体の遷移先にこちらを使用
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
                    <Megaphone className="size-3.5 shrink-0 text-brand" />
                    <code className="truncate text-xs text-ink">{adUrl(c.code)}</code>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
