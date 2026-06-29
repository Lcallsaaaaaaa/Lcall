import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/Form";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { createReservation } from "@/features/reservations/actions";
import { getBookingView } from "@/features/reservations/queries";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ u?: string; menu?: string; date?: string; submitted?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = await getBookingView(id, { date: sp.date, menuId: sp.menu });
  if (!view) notFound();
  const { page, menus, days, selectedMenu, selectedDate, slots } = view;
  const u = sp.u;

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (u) p.set("u", u);
    if (extra.menu ?? (page.type === "menu" ? selectedMenu?.id : undefined))
      p.set("menu", extra.menu ?? selectedMenu!.id);
    if (extra.date) p.set("date", extra.date);
    return `/yoyaku/${id}${p.toString() ? `?${p.toString()}` : ""}`;
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <GradientLogo />
        </div>

        {sp.submitted ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <CheckCircle2 className="mx-auto size-10 text-ok" />
            <h1 className="mt-3 text-xl font-semibold text-ink">予約が確定しました</h1>
            <p className="mt-1 text-sm text-muted">ご予約ありがとうございます。</p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h1 className="text-xl font-semibold text-ink">{page.title}</h1>
            {page.description && <p className="mt-1 text-sm text-muted">{page.description}</p>}

            {sp.error && (
              <p className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
                {sp.error === "full"
                  ? "選択した枠は満席になりました。別の時間をお選びください。"
                  : "予約できませんでした。時間を選び直してください。"}
              </p>
            )}

            {/* メニュー型：メニュー未選択ならメニュー一覧 */}
            {page.type === "menu" && !selectedMenu ? (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-ink">メニューを選択</p>
                {menus.length === 0 ? (
                  <p className="text-sm text-muted">メニューがまだありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {menus.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={qs({ menu: m.id })}
                          className="flex items-center justify-between rounded-lg border border-line px-4 py-3 transition hover:border-brand hover:bg-surface-2"
                        >
                          <span className="font-medium text-ink">{m.name}</span>
                          <span className="text-sm text-muted">
                            {m.durationMinutes}分{m.price != null ? ` / ¥${m.price.toLocaleString()}` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                {selectedMenu && (
                  <p className="mt-4 text-sm text-muted">
                    メニュー：<span className="font-medium text-ink">{selectedMenu.name}</span>（{selectedMenu.durationMinutes}分）{" "}
                    <Link href={qs({ menu: undefined, date: selectedDate })} className="text-brand hover:underline">
                      変更
                    </Link>
                  </p>
                )}

                {/* 日付選択 */}
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium text-ink">日付を選択</p>
                  {days.length === 0 ? (
                    <p className="text-sm text-muted">現在予約を受け付けていません。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {days.map((d) => (
                        <Link
                          key={d.value}
                          href={qs({ date: d.value })}
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
                  )}
                </div>

                {/* 時間枠 */}
                {selectedDate && (
                  <form action={createReservation.bind(null, id)} className="mt-5 space-y-4">
                    {u && <input type="hidden" name="u" value={u} />}
                    {selectedMenu && <input type="hidden" name="menuId" value={selectedMenu.id} />}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="お名前（任意）" htmlFor="name">
                        <Input id="name" name="name" />
                      </FormField>
                      <FormField label="電話番号（任意）" htmlFor="phone">
                        <Input id="phone" name="phone" type="tel" />
                      </FormField>
                    </div>
                    <FormField label="ご要望（任意）" htmlFor="note">
                      <Textarea id="note" name="note" />
                    </FormField>

                    <p className="text-sm font-medium text-ink">時間を選んで予約</p>
                    {slots.length === 0 ? (
                      <p className="text-sm text-muted">この日の予約枠がありません。</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((s) => (
                          <button
                            key={s.startISO}
                            type="submit"
                            name="startISO"
                            value={s.startISO}
                            disabled={!s.available}
                            className={
                              s.available
                                ? "rounded-lg border border-brand/40 bg-brand/5 px-2 py-2 text-sm font-medium text-ink transition hover:bg-brand hover:text-white"
                                : "cursor-not-allowed rounded-lg border border-line px-2 py-2 text-sm text-faint line-through"
                            }
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-faint">Powered by LCall</p>
      </div>
    </main>
  );
}
