import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { GradientLogo } from "@/components/ui/GradientLogo";
import { submitFormResponse } from "@/features/forms/actions";
import { getForm } from "@/features/forms/queries";
import type { FormField as FormFieldModel } from "@/lib/data/types";

function FieldControl({ field }: { field: FormFieldModel }) {
  const id = field.id;
  switch (field.type) {
    case "textarea":
      return <Textarea id={id} name={id} required={field.required} />;
    case "select":
      return (
        <Select id={id} name={id} defaultValue="" required={field.required}>
          <option value="" disabled>
            選択してください
          </option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case "checkbox":
      return (
        <div className="space-y-1.5">
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name={id} value={o} className="accent-[#dd2a7b]" />
              {o}
            </label>
          ))}
        </div>
      );
    case "email":
      return <Input id={id} name={id} type="email" required={field.required} />;
    case "tel":
      return <Input id={id} name={id} type="tel" required={field.required} />;
    case "date":
      return <Input id={id} name={id} type="date" required={field.required} />;
    default:
      return <Input id={id} name={id} required={field.required} />;
  }
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; u?: string }>;
}) {
  const { id } = await params;
  const { submitted, u } = await searchParams;
  const data = await getForm(id);
  if (!data) notFound();
  const { form, fields } = data;

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
            <p className="mt-1 text-sm text-muted">ご回答ありがとうございました。</p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h1 className="text-xl font-semibold text-ink">{form.title}</h1>
            {form.description && <p className="mt-1 text-sm text-muted">{form.description}</p>}

            <form action={submitFormResponse.bind(null, id)} className="mt-6 space-y-4">
              {u && <input type="hidden" name="u" value={u} />}
              {fields.map((f) => (
                <FormField key={f.id} label={f.label} htmlFor={f.id} required={f.required}>
                  <FieldControl field={f} />
                </FormField>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-muted">このフォームにはまだ項目がありません。</p>
              )}
              <button type="submit" className={buttonClasses("gradient", "lg", "w-full")}>
                送信する
              </button>
            </form>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-faint">Powered by LCall</p>
      </div>
    </main>
  );
}
