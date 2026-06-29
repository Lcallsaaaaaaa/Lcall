import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { cancelReservationPublic } from "@/features/reservations/actions";
import { getCancelView } from "@/features/reservations/queries";

export const dynamic = "force-dynamic";

const fmt = (s: string) =>
  new Date(s).toLocaleString("ja-JP", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

export default async function CancelReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ r?: string; t?: string; done?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = await getCancelView(id, sp.r ?? "", sp.t ?? "");
  if (!view) notFound();
  const { page, reservation, menuName, optionNames, valid } = view;

  const Box = ({ children }: { children: React.ReactNode }) => (
    <main className="flex min-h-screen items-start justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <GradientLogo />
        </div>
        <div className="rounded-xl border border-line bg-surface p-8 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">{children}</div>
        <p className="mt-6 text-center text-xs text-faint">Powered by LCall</p>
      </div>
    </main>
  );

  if (!valid || sp.error === "invalid") {
    return (
      <Box>
        <AlertTriangle className="mx-auto size-10 text-warn" />
        <h1 className="mt-3 text-center text-xl font-semibold text-ink">リンクが無効です</h1>
        <p className="mt-1 text-center text-sm text-muted">お手数ですが店舗までお問い合わせください。</p>
      </Box>
    );
  }

  if (sp.error === "deadline") {
    return (
      <Box>
        <AlertTriangle className="mx-auto size-10 text-warn" />
        <h1 className="mt-3 text-center text-xl font-semibold text-ink">変更・キャンセルの受付は終了しました</h1>
        <p className="mt-1 text-center text-sm text-muted">お手数ですが店舗までご連絡ください。</p>
      </Box>
    );
  }

  if (sp.done || reservation.status === "cancelled") {
    return (
      <Box>
        <CheckCircle2 className="mx-auto size-10 text-ok" />
        <h1 className="mt-3 text-center text-xl font-semibold text-ink">キャンセルしました</h1>
        <p className="mt-1 text-center text-sm text-muted">ご予約はキャンセルされました。</p>
      </Box>
    );
  }

  return (
    <Box>
      <h1 className="text-center text-xl font-semibold text-ink">ご予約のキャンセル</h1>
      <div className="mt-5 rounded-lg border border-line bg-surface-2 p-4 text-sm text-ink">
        <p className="font-medium">{page.title}</p>
        <p className="mt-1">日時：{fmt(reservation.startAt)}</p>
        {menuName && (
          <p>
            メニュー：{menuName}
            {optionNames.length > 0 && `（＋${optionNames.join("、")}）`}
          </p>
        )}
      </div>
      <a
        href={`/yoyaku/${id}/change?r=${reservation.id}&t=${encodeURIComponent(sp.t ?? "")}`}
        className={buttonClasses("outline", "lg", "mt-5 w-full")}
      >
        日時を変更する
      </a>
      <p className="mt-5 text-center text-sm text-muted">またはこの予約をキャンセルしますか？</p>
      <form action={cancelReservationPublic.bind(null, id)} className="mt-3">
        <input type="hidden" name="r" value={reservation.id} />
        <input type="hidden" name="t" value={sp.t ?? ""} />
        <button type="submit" className="w-full rounded-lg border border-danger/40 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger-bg">
          キャンセルする
        </button>
      </form>
    </Box>
  );
}
