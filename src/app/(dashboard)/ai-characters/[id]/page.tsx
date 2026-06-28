import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { deleteAiCharacter, updateAiCharacter } from "@/features/ai-characters/actions";
import { getAiCharacter } from "@/features/ai-characters/queries";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/lib/anthropic";

export default async function AiCharacterEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const character = await getAiCharacter(id);
  if (!character) notFound();

  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      <Link href="/ai-characters" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        AIキャラ一覧へ
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">{character.name}</h1>

      <Card className="mb-5">
        <CardHeader title="キャラ設定" description="この内容がAI返信のシステムプロンプトになります。" />
        <form action={updateAiCharacter.bind(null, id)} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="キャラ名" htmlFor="name" required hint="AI返信の差出人名にも使用">
              <Input id="name" name="name" defaultValue={character.name} required />
            </FormField>
            <FormField label="モデル" htmlFor="model">
              <Select id="model" name="model" defaultValue={character.model ?? DEFAULT_AI_MODEL}>
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField
            label="性格・口調・役割（ペルソナ）"
            htmlFor="persona"
            hint="例: 明るく親しみやすい20代スタッフ風。語尾は『〜です』。分からないことは担当者へ引き継ぐ。"
          >
            <Textarea id="persona" name="persona" defaultValue={character.persona} rows={5} placeholder="このキャラの性格・口調・ルールを記述します。" />
          </FormField>
          <FormField label="業務知識・FAQ" htmlFor="faq" hint="Q&A や箇条書き。AIはこの範囲を根拠に回答します。">
            <Textarea id="faq" name="faq" defaultValue={character.faq} rows={6} placeholder={"Q: 営業時間は？\nA: 平日10-18時です。"} />
          </FormField>
          <FormField label="アバター画像URL（任意）" htmlFor="avatarUrl">
            <Input id="avatarUrl" name="avatarUrl" defaultValue={character.avatarUrl} placeholder="https://..." />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" variant="gradient" size="md">
              保存
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="削除" description="このキャラを削除します。割り当て済みのアカウント/タグ/友だちからも解除されます。" />
        <div className="p-5">
          <form action={deleteAiCharacter.bind(null, id)}>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg">
              <Trash2 className="size-4" />
              このキャラを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
