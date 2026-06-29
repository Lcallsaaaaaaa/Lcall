import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LineAccountForm } from "@/components/features/LineAccountForm";
import { listAiCharacters } from "@/features/ai-characters/queries";
import { createLineAccount } from "@/features/line-accounts/actions";
import { activeLineCount, getPlanLimit } from "@/features/line-accounts/queries";
import { getDataProvider } from "@/lib/data/provider";

export default async function NewLineAccountPage() {
  const [accounts, limit, characters] = await Promise.all([
    getDataProvider().lineAccounts.list(),
    getPlanLimit(),
    listAiCharacters(),
  ]);
  if (activeLineCount(accounts) >= limit) redirect("/line-accounts?error=limit");

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
        LINEアカウントを追加
      </h1>
      <LineAccountForm action={createLineAccount} submitLabel="登録する" characters={characters} />
    </div>
  );
}
