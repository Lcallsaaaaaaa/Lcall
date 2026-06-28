import { Bot, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { createAiCharacter, deleteAiCharacter } from "@/features/ai-characters/actions";
import { listAiCharacters } from "@/features/ai-characters/queries";
import { AI_MODELS } from "@/lib/anthropic";

const modelLabel = (id?: string) => AI_MODELS.find((m) => m.id === id)?.label ?? id ?? "—";

export default async function AiCharactersPage() {
  const characters = await listAiCharacters();

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">AIキャラ</h1>
        <p className="mt-1 text-sm text-muted">
          AI自動応答のキャラクター（口調・知識・モデル）を作成。LINEアカウント／タグ／友だちに割り当てて出し分けます。
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title="キャラを作成" />
        <form action={createAiCharacter} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="キャラ名" htmlFor="name" required className="min-w-48 flex-1">
            <Input id="name" name="name" placeholder="サポートのあい" required />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Plus className="size-4" />
            作成
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="登録済みのキャラ" description={`${characters.length}体`} />
        {characters.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted">
            <Bot className="size-4" /> まだありません。
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {characters.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/ai-characters/${c.id}`} className="font-medium text-ink hover:text-brand">
                      {c.name}
                    </Link>
                    <Badge tone="neutral">{modelLabel(c.model)}</Badge>
                  </div>
                  {c.persona && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.persona}</p>}
                </div>
                <form action={deleteAiCharacter.bind(null, c.id)}>
                  <button type="submit" className="rounded-md p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger" title="削除">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
