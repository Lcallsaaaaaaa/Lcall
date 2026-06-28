import type { SurveyQuestionType } from "@/lib/data/types";

export const QUESTION_TYPE_LABEL: Record<SurveyQuestionType, string> = {
  rating5: "5段階評価",
  select: "選択式",
  textarea: "自由記述",
};
