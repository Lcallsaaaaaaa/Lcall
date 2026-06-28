import type { FormFieldType } from "@/lib/data/types";

export const FIELD_TYPE_LABEL: Record<FormFieldType, string> = {
  text: "1行テキスト",
  email: "メール",
  tel: "電話番号",
  select: "選択式",
  checkbox: "チェックボックス",
  date: "日付",
  textarea: "自由記述",
};

/** options が必要なフィールド種別 */
export const FIELD_NEEDS_OPTIONS: FormFieldType[] = ["select", "checkbox"];
