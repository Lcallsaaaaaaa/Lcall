import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Form";
import { listAiCharacters } from "@/features/ai-characters/queries";
import { deleteTag, updateTag } from "@/features/tags/actions";
import { getTag } from "@/features/tags/queries";

export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tag, characters] = await Promise.all([getTag(id), listAiCharacters()]);
  if (!tag) notFound();

  return (
    <div className="mx-auto max-w-xl p-6 lg:p-8">
      <Link
        href="/tags"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        タグ一覧へ
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">タグを編集</h1>

      <Card>
        <CardHeader title="基本情報" />
        <form action={updateTag.bind(null, id)} className="space-y-4 p-5">
          <FormField label="タグ名" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={tag.name} required />
          </FormField>
          <FormField label="色" htmlFor="color">
            <input
              id="color"
              name="color"
              type="color"
              defaultValue={tag.color ?? "#dd2a7b"}
              className="h-10 w-16 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
            />
          </FormField>
          <FormField
            label="AIキャラ（このタグの顧客に適用）"
            htmlFor="aiCharacterId"
            hint="このタグを持つ友だちのAI応答を、指定キャラで出し分けます（友だち個別設定が最優先）。"
          >
            <Select id="aiCharacterId" name="aiCharacterId" defaultValue={tag.aiCharacterId ?? ""}>
              <option value="">（なし＝アカウント既定）</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-1">
            <Link href="/tags" className={buttonClasses("ghost", "md")}>
              キャンセル
            </Link>
            <button type="submit" className={buttonClasses("gradient", "md")}>
              更新する
            </button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <CardHeader title="削除" description="このタグを削除し、全顧客から外します。" />
        <div className="p-5">
          <form action={deleteTag.bind(null, id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg"
            >
              <Trash2 className="size-4" />
              このタグを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
