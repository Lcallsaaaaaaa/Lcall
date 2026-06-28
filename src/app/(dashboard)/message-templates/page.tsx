import { Plus, Trash2 } from "lucide-react";
import { VarTextarea } from "@/components/features/VarTextarea";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Form";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  updateMessageTemplate,
} from "@/features/message-templates/actions";
import { listMessageTemplates } from "@/features/message-templates/queries";

export default async function MessageTemplatesPage() {
  const templates = await listMessageTemplates();

  return (
    <div className="mx-auto max-w-[900px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">定型文</h1>
        <p className="mt-1 text-sm text-muted">
          チャット対応でよく使う返信文を登録します。受信箱で選んで返信欄に挿入し、編集して送信できます。
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title="定型文を作成" />
        <form action={createMessageTemplate} className="space-y-4 p-5">
          <FormField label="タイトル" htmlFor="title" required>
            <Input id="title" name="title" placeholder="お礼 / 営業時間案内 など" required />
          </FormField>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">本文</label>
            <VarTextarea name="text" placeholder="送信するメッセージ本文" required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="gradient" size="md">
              <Plus className="size-4" />
              作成
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="登録済みの定型文" description={`${templates.length}件 — 編集して保存できます`} />
        {templates.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">まだありません。</p>
        ) : (
          <ul className="divide-y divide-line">
            {templates.map((t) => (
              <li key={t.id} className="p-5">
                <form action={updateMessageTemplate.bind(null, t.id)} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input name="title" defaultValue={t.title} className="flex-1" required />
                    <Button type="submit" variant="outline" size="sm">
                      保存
                    </Button>
                  </div>
                  <VarTextarea name="text" defaultValue={t.text} required />
                </form>
                <div className="mt-2 flex justify-end">
                  <form action={deleteMessageTemplate.bind(null, t.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-danger-bg hover:text-danger"
                      title="削除"
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
    </div>
  );
}
