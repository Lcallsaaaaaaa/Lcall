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
  searchParams: Promise<{ u?: string; menu?: string; date?: string; opt?: string | string[]; submitted?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const optionIds = Array.isArray(sp.opt) ? sp.opt : sp.opt ? [sp.opt] : [];
  const view = await getBookingView(id, { date: sp.date, menuId: sp.menu, optionIds });
  if (!view) notFound();
  const { page, menus, options, days, selectedMenu, selectedOptions, totalDuration, totalPrice, selectedDate, slots } = view;
  const u = sp.u;

  // menu/date 切替リンク。選択中のオプションも引き継ぐ（opts で上書き可、menu:null で先頭=メニュー選択へ戻す）
  const qs = (extra: { menu?: string | null; date?: string; opts?: string[] } = {}) => {
    const p = new URLSearchParams();
    if (u) p.set("u", u);
    const menuVal = extra.menu === null ? undefined : (extra.menu ?? (page.type === "menu" ? selectedMenu?.id : undefined));
    if (menuVal) p.set("menu", menuVal);
    if (extra.date) p.set("date", extra.date);
    for (const o of extra.opts ?? selectedOptions.map((s) => s.id)) p.append("opt", o);
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
                    <Link href={`/yoyaku/${id}${u ? `?u=${u}` : ""}`} className="text-brand hover:underline">
                      変更
                    </Link>
                  </p>
                )}

                {/* オプション選択（メニュー型・オプションがある場合） */}
                {page.type === "menu" && selectedMenu && options.length > 0 && (
                  <form method="get" action={`/yoyaku/${id}`} className="mt-5 rounded-lg border border-line p-4">
                    {u && <input type="hidden" name="u" value={u} />}
                    <input type="hidden" name="menu" value={selectedMenu.id} />
                    {selectedDate && <input type="hidden" name="date" value={selectedDate} />}
                    <p className="mb-2 text-sm font-medium text-ink">オプション（任意・複数選択可）</p>
                    <div className="space-y-1.5">
                      {options.map((o) => (
                        <label key={o.id} className="flex items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            name="opt"
                            value={o.id}
                            defaultChecked={selectedOptions.some((s) => s.id === o.id)}
                            className="accent-[#dd2a7b]"
                          />
                          {o.name}
                          <span className="text-muted">
                            +{o.durationMinutes}分{o.price != null ? ` / +¥${o.price.toLocaleString()}` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button type="submit" className={buttonClasses("outline", "sm", "mt-3")}>
                      オプションを反映
                    </button>
                  </form>
                )}

                {/* 合計（メニュー＋オプション） */}
                {selectedMenu && (
                  <p className="mt-3 text-sm text-ink">
                    合計：約{totalDuration}分
                    {totalPrice != null && ` / ¥${totalPrice.toLocaleString()}`}
                    {selectedOptions.length > 0 && (
                      <span className="text-muted">（オプション：{selectedOptions.map((o) => o.name).join("、")}）</span>
                    )}
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
                    {selectedOptions.map((o) => (
                      <input key={o.id} type="hidden" name="optionIds" value={o.id} />
                    ))}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="お名前" htmlFor="name" required>
                        <Input id="name" name="name" required />
                      </FormField>
                      <FormField label="電話番号" htmlFor="phone" required>
                        <Input id="phone" name="phone" type="tel" required />
                      </FormField>
                    </div>
                    <FormField label="ご要望（任意）" htmlFor="note">
                      <Textarea
                        id="note"
                        name="note"
                        placeholder="事前にご相談内容が分かっているとスムーズにいきますので、ご記入ご協力お願いします。"
                      />
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
