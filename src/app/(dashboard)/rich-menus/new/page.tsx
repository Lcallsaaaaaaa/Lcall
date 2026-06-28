import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Form";
import { RICH_MENU_TEMPLATES } from "@/config/rich-menu-templates";
import { createRichMenu } from "@/features/rich-menus/actions";
import { getDataProvider } from "@/lib/data/provider";

export default async function NewRichMenuPage() {
  const [accounts, tags] = await Promise.all([
    getDataProvider().lineAccounts.list(),
    getDataProvider().tags.list(),
  ]);
  if (accounts.length === 0) redirect("/line-accounts?error=needaccount");

  const large = RICH_MENU_TEMPLATES.filter((t) => t.size === "large");
  const compact = RICH_MENU_TEMPLATES.filter((t) => t.size === "compact");

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link href="/rich-menus" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        リッチメニュー一覧へ
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">リッチメニューを作成</h1>

      <form action={createRichMenu} className="space-y-5">
        <Card>
          <CardHeader title="基本情報" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="管理名称" htmlFor="name" required>
              <Input id="name" name="name" placeholder="メインメニュー" required />
            </FormField>
            <FormField label="メニューバーの文言" htmlFor="chatBarText" hint="トーク下部に表示（14文字まで）">
              <Input id="chatBarText" name="chatBarText" defaultValue="メニュー" maxLength={14} />
            </FormField>
            <FormField label="LINEアカウント" htmlFor="lineAccountId" required className="sm:col-span-2">
              <Select id="lineAccountId" name="lineAccountId" required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="レイアウト" description="定番テンプレートから選びます。あとで各ボタンにアクションを設定します。" />
          <div className="p-5">
            <FormField label="テンプレート" htmlFor="template">
              <Select id="template" name="template" defaultValue="large-2x3">
                <optgroup label="大サイズ（2500×1686）">
                  {large.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="小サイズ（2500×843）">
                  {compact.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
              </Select>
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="反映先" description="誰のトーク画面に表示するか。" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="表示対象" htmlFor="scope">
              <Select id="scope" name="scope" defaultValue="default">
                <option value="default">既定メニュー（全友だちに表示）</option>
                <option value="tag">タグ別の出し分け</option>
              </Select>
            </FormField>
            <FormField label="対象タグ" htmlFor="targetTagId" hint="「タグ別の出し分け」を選んだ場合に指定">
              <Select id="targetTagId" name="targetTagId" defaultValue="">
                <option value="">（タグを選択）</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link href="/rich-menus" className={buttonClasses("ghost", "md")}>キャンセル</Link>
          <button type="submit" className={buttonClasses("gradient", "md")}>作成して編集へ</button>
        </div>
      </form>
    </div>
  );
}
