import { getDataProvider } from "@/lib/data/provider";
import type { Survey, SurveyQuestion } from "@/lib/data/types";

export interface SurveyRow extends Survey {
  questionCount: number;
  responseCount: number;
  autoTagName?: string;
}

export async function listSurveys(): Promise<SurveyRow[]> {
  const db = getDataProvider();
  const [surveys, questions, responses, tags] = await Promise.all([
    db.surveys.list(),
    db.surveyQuestions.list(),
    db.surveyResponses.list(),
    db.tags.list(),
  ]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const qCount = new Map<string, number>();
  for (const q of questions) qCount.set(q.surveyId, (qCount.get(q.surveyId) ?? 0) + 1);
  const rCount = new Map<string, number>();
  for (const r of responses) rCount.set(r.surveyId, (rCount.get(r.surveyId) ?? 0) + 1);

  return surveys
    .map((s) => ({
      ...s,
      questionCount: qCount.get(s.id) ?? 0,
      responseCount: rCount.get(s.id) ?? 0,
      autoTagName: s.autoTagId ? tagName.get(s.autoTagId) : undefined,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export interface SurveyWithQuestions {
  survey: Survey;
  questions: SurveyQuestion[];
  autoTagName?: string;
  responseCount: number;
}

export async function getSurvey(id: string): Promise<SurveyWithQuestions | null> {
  const db = getDataProvider();
  const survey = await db.surveys.get(id);
  if (!survey) return null;
  const [questions, responses, tags] = await Promise.all([
    db.surveyQuestions.list(),
    db.surveyResponses.list(),
    db.tags.list(),
  ]);
  return {
    survey,
    questions: questions.filter((q) => q.surveyId === id).sort((a, b) => a.order - b.order),
    autoTagName: survey.autoTagId ? tags.find((t) => t.id === survey.autoTagId)?.name : undefined,
    responseCount: responses.filter((r) => r.surveyId === id).length,
  };
}

export interface QuestionAnalysis {
  question: SurveyQuestion;
  answered: number;
  /** rating5 の平均 */
  average?: number;
  /** rating5 / select の分布 */
  distribution?: { label: string; count: number }[];
  /** textarea の回答サンプル */
  answers?: string[];
}

export async function getSurveyAnalysis(id: string): Promise<{
  survey: Survey;
  total: number;
  questions: QuestionAnalysis[];
} | null> {
  const db = getDataProvider();
  const survey = await db.surveys.get(id);
  if (!survey) return null;
  const [questions, responses] = await Promise.all([
    db.surveyQuestions.list(),
    db.surveyResponses.list(),
  ]);
  const qs = questions.filter((q) => q.surveyId === id).sort((a, b) => a.order - b.order);
  const rs = responses.filter((r) => r.surveyId === id);

  const analyses: QuestionAnalysis[] = qs.map((q) => {
    const raw = rs.map((r) => r.values[q.id]).filter((v) => v !== undefined && v !== "");
    if (q.type === "rating5") {
      const nums = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      const average = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
      const distribution = [1, 2, 3, 4, 5].map((n) => ({
        label: `${n}`,
        count: nums.filter((x) => x === n).length,
      }));
      return { question: q, answered: nums.length, average, distribution };
    }
    if (q.type === "select") {
      const opts = q.options ?? [];
      const distribution = opts.map((o) => ({
        label: o,
        count: raw.filter((v) => String(v) === o).length,
      }));
      return { question: q, answered: raw.length, distribution };
    }
    return { question: q, answered: raw.length, answers: raw.map(String).slice(0, 20) };
  });

  return { survey, total: rs.length, questions: analyses };
}

export interface SurveyResponseRow {
  id: string;
  createdAt: string;
  friendName: string;
  values: Record<string, string | number>;
}

export async function getSurveyResponses(id: string): Promise<{
  survey: Survey;
  questions: SurveyQuestion[];
  rows: SurveyResponseRow[];
} | null> {
  const db = getDataProvider();
  const survey = await db.surveys.get(id);
  if (!survey) return null;
  const [questions, responses, friends] = await Promise.all([
    db.surveyQuestions.list(),
    db.surveyResponses.list(),
    db.friends.list(),
  ]);
  const friendName = new Map(friends.map((f) => [f.id, f.displayName]));
  return {
    survey,
    questions: questions.filter((q) => q.surveyId === id).sort((a, b) => a.order - b.order),
    rows: responses
      .filter((r) => r.surveyId === id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        friendName: r.friendId ? (friendName.get(r.friendId) ?? r.friendId) : "—",
        values: r.values,
      })),
  };
}
