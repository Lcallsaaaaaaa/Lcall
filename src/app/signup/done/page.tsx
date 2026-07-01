import { CheckCircle2, Clock } from "lucide-react";
import { notFound } from "next/navigation";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { getDataProvider } from "@/lib/data/provider";
import { isControlPlane } from "@/lib/operator";
import { tenantBaseUrl } from "@/features/operator/provision";

export const dynamic = "force-dynamic";

export default async function SignupDonePage({
  searchParams,
}: {
  searchParams: Promise<{ ca?: string }>;
}) {
  if (!isControlPlane()) notFound();

  const { ca } = await searchParams;
  const db = getDataProvider();
  const client = ca ? await db.clientAccounts.get(ca) : null;
  const instance = client
    ? (await db.clientInstances.list()).find((i) => i.clientAccountId === client.id) ?? null
    : null;

  const loginUrl = client ? `${tenantBaseUrl(client.slug)}/login` : "";
  const ready = instance?.provisionStatus === "ready";

  return (
    <main className="min-h-screen bg-canvas px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <GradientLogo />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">お申し込みありがとうございます</h1>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {!client ? (
            <p className="text-sm text-muted">お申し込み内容を確認できませんでした。お手数ですが運営までご連絡ください。</p>
          ) : ready ? (
            <>
              <div className="mb-4 flex items-center gap-2 text-success">
                <CheckCircle2 className="size-5" />
                <span className="font-medium">システムの発行が完了しました</span>
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted">あなたの管理画面</dt>
                  <dd className="mt-0.5">
                    <a href={loginUrl} className="font-medium text-brand underline-offset-2 hover:underline">
                      {loginUrl}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">ログインID（メール）</dt>
                  <dd className="mt-0.5 font-medium text-ink">{client.contactEmail}</dd>
                </div>
                <div>
                  <dt className="text-muted">パスワード</dt>
                  <dd className="mt-0.5 text-ink">お申し込み時にご入力いただいたパスワード</dd>
                </div>
              </dl>
              <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                上記URLからログインし、LINE公式アカウントを接続すると配信を始められます。
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2 text-ink">
                <Clock className="size-5 text-muted" />
                <span className="font-medium">システムを準備しています</span>
              </div>
              <p className="text-sm text-muted">
                決済を確認しました。<span className="font-medium text-ink">{client.slug}.
                {(process.env.LCALL_TENANT_BASE_DOMAIN || "lcall.shop").replace(/^https?:\/\//, "")}</span>{" "}
                のシステムを発行しています（数十秒）。この画面を<span className="font-medium text-ink">再読み込み</span>すると、ログインURLが表示されます。
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
