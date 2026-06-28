import { ArrowLeft, Link2, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineAccountForm } from "@/components/features/LineAccountForm";
import { Card, CardHeader } from "@/components/ui/Card";
import { listAiCharacters } from "@/features/ai-characters/queries";
import { deleteLineAccount, updateLineAccount } from "@/features/line-accounts/actions";
import { getLineAccount } from "@/features/line-accounts/queries";

export default async function EditLineAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [account, h, characters] = await Promise.all([
    getLineAccount(id),
    headers(),
    listAiCharacters(),
  ]);
  if (!account) notFound();

  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const webhookUrl = `${proto}://${host}/api/line/webhook/${id}`;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link
        href="/line-accounts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        LINEアカウント一覧へ
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        LINEアカウントを編集
      </h1>

      <Card className="mb-5">
        <CardHeader
          title="LINE Webhook URL"
          description="LINE Developers のチャネル設定 → Webhook URL にこのURLを登録し、Webhookを「オン」にしてください。"
        />
        <div className="space-y-2 p-5">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <Link2 className="size-4 shrink-0 text-muted" />
            <code className="truncate text-xs text-ink">{webhookUrl}</code>
          </div>
          <p className="text-xs text-muted">
            受信メッセージはチャット対応（受信箱）に届きます。Channel Secret / Access Token を上に入力すると、署名検証と返信送信が有効になります。
          </p>
        </div>
      </Card>

      <LineAccountForm
        action={updateLineAccount.bind(null, id)}
        account={account}
        submitLabel="更新する"
        characters={characters}
      />

      <Card className="mt-6 border-danger/30">
        <CardHeader title="削除" description="このLINEアカウントを削除します。元に戻せません。" />
        <div className="p-5">
          <form action={deleteLineAccount.bind(null, id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg"
            >
              <Trash2 className="size-4" />
              このアカウントを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
