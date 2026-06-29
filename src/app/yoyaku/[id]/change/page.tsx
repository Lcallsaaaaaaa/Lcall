import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { rescheduleReservation } from "@/features/reservations/actions";
import { getChangeView } from "@/features/reservations/queries";
import { SlotButtons } from "@/components/features/SlotButtons";

export const dynamic = "force-dynamic";

const fmt = (s: string) =>
  new Date(s).toLocaleString("ja-JP", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

export default async function ChangeReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ r?: string; t?: string; date?: string; done?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = await getChangeView(id, sp.r ?? "", sp.t ?? "", sp.date);
  if (!view) notFound();
  const { page, reservation, menuName, optionNames, valid, deadlinePassed, days, selectedDate, slots } = view;

  const Box = ({ children }: { children: React.ReactNode }) => (
    <main className="flex min-h-screen items-start justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <GradientLogo />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">{children}</div>
        <p className="mt-6 text-center text-xs text-faint">Powered by LCall</p>
      </div>
    </main>
  );

  const link = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ r: sp.r ?? "", t: sp.t ?? "", ...extra });
    return `/yoyaku/${id}/change?${p.toString()}`;
  };

  if (!valid) {
    return (
      <Box>
        <AlertTriangle className="mx-auto size-10 text-warn" />
        <h1 className="mt-3 text-center text-xl font-semibold text-ink">リンクが無効です</h1>
      </Box>
    );
  }
  if (sp.done) {
    return (
      <Box>
        <CheckCircle2 className="mx-auto size-10 text-ok" />
        <h1 className="mt-3 text-center text-xl font-semibold text-ink">日時を変更しました</h1>
        <p className="mt-1 text-center text-sm text-muted">新しいご予約：{fmt(reservation.startAt)}</p>
      </Box>
    );
  }
  if (deadlinePassed) {
    return (
      <Box>
        <AlertTriangle className="mx-auto size-10 text-warn" />
        <h1 className="mt-3 text-center text-xl font-semibold text-ink">変更の受付は終了しました</h1>
        <p className="mt-1 text-center text-sm text-muted">お手数ですが店舗までご連絡ください。</p>
      </Box>
    );
  }

  return (
    <Box>
      <h1 className="text-xl font-semibold text-ink">予約日時の変更</h1>
      <div className="mt-4 rounded-lg border border-line bg-surface-2 p-4 text-sm text-ink">
        <p>現在のご予約：{fmt(reservation.startAt)}</p>
        {menuName && (
          <p className="text-muted">
            {menuName}
            {optionNames.length > 0 && `（＋${optionNames.join("、")}）`}
          </p>
        )}
      </div>

      {sp.error && (
        <p className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {sp.error === "full" ? "選択した枠は埋まっています。別の時間をお選びください。" : "変更できませんでした。もう一度お試しください。"}
        </p>
      )}

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-ink">新しい日付を選択</p>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Link
              key={d.value}
              href={link({ date: d.value })}
              className={
                d.value === selectedDate
                  ? "rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-line px-3 py-1.5 text-sm text-ink transition hover:bg-surface-2"
              }
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>

      {selectedDate && (
        <form action={rescheduleReservation.bind(null, id)} className="mt-5">
          <input type="hidden" name="r" value={sp.r ?? ""} />
          <input type="hidden" name="t" value={sp.t ?? ""} />
          <p className="mb-2 text-sm font-medium text-ink">新しい時間を選んで変更</p>
          <SlotButtons slots={slots} />
        </form>
      )}
    </Box>
  );
}
