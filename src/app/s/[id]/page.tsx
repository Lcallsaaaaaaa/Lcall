import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { FormField, Select, Textarea } from "@/components/ui/Form";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { submitSurveyResponse } from "@/features/surveys/actions";
import { getSurvey } from "@/features/surveys/queries";
import type { SurveyQuestion } from "@/lib/data/types";

function QuestionControl({ q }: { q: SurveyQuestion }) {
  if (q.type === "rating5") {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-line text-sm text-ink transition has-[:checked]:border-brand has-[:checked]:bg-surface-2"
          >
            <input type="radio" name={q.id} value={n} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "select") {
    return (
      <Select name={q.id} defaultValue="">
        <option value="" disabled>
          選択してください
        </option>
        {(q.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  return <Textarea name={q.id} />;
}

export default async function PublicSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; u?: string }>;
}) {
  const { id } = await params;
  const { submitted, u } = await searchParams;
  const data = await getSurvey(id);
  if (!data) notFound();
  const { survey, questions } = data;

  return (
    <main className="flex min-h-screen items-start justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <GradientLogo />
        </div>

        {submitted ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <CheckCircle2 className="mx-auto size-10 text-ok" />
            <h1 className="mt-3 text-xl font-semibold text-ink">送信しました</h1>
            <p className="mt-1 text-sm text-muted">ご協力ありがとうございました。</p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h1 className="text-xl font-semibold text-ink">{survey.title}</h1>
            <form action={submitSurveyResponse.bind(null, id)} className="mt-6 space-y-5">
              {u && <input type="hidden" name="u" value={u} />}
              {questions.map((q) => (
                <FormField key={q.id} label={q.label}>
                  <QuestionControl q={q} />
                </FormField>
              ))}
              {questions.length === 0 && <p className="text-sm text-muted">このアンケートにはまだ設問がありません。</p>}
              <button type="submit" className={buttonClasses("gradient", "lg", "w-full")}>
                回答を送信
              </button>
            </form>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-faint">Powered by LCall</p>
      </div>
    </main>
  );
}
