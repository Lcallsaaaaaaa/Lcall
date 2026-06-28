import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewBroadcastForm } from "@/components/features/NewBroadcastForm";
import { listAdCodes } from "@/features/ad-codes/queries";
import { listLineAccounts } from "@/features/line-accounts/queries";
import { listTags } from "@/features/tags/queries";

export default async function NewBroadcastPage() {
  const [tags, accounts, adCodes] = await Promise.all([listTags(), listLineAccounts(), listAdCodes()]);

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link
        href="/broadcasts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        配信一覧へ
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">配信を作成</h1>
      <NewBroadcastForm tags={tags} accounts={accounts} adCodes={adCodes} />
    </div>
  );
}
