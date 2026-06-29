"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import type { SurveyQuestion, SurveyQuestionType } from "@/lib/data/types";

function str(v: FormDataEntryValue | null): string {
  return (v == null ? "" : String(v)).trim();
}
function uid(p: string): string {
  return `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
function parseQType(v: FormDataEntryValue | null): SurveyQuestionType {
  const s = String(v ?? "");
  return s === "rating5" || s === "select" || s === "textarea" ? s : "textarea";
}

export async function createSurvey(formData: FormData) {
  const id = uid("sv");
  await getDataProvider().surveys.create({
    id,
    title: str(formData.get("title")) || "無題のアンケート",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/surveys");
  redirect(`/surveys/${id}`);
}

/** 回答に既存のLINE顧客を手動で紐づける（?u 無しで入力された回答の救済）。 */
export async function linkSurveyResponseToFriend(responseId: string, surveyId: string, formData: FormData) {
  const friendId = str(formData.get("friendId"));
  if (friendId) await getDataProvider().surveyResponses.update(responseId, { friendId });
  revalidatePath(`/surveys/${surveyId}/responses`);
}

export async function updateSurvey(id: string, formData: FormData) {
  await getDataProvider().surveys.update(id, {
    title: str(formData.get("title")) || "無題のアンケート",
    autoTagId: str(formData.get("autoTagId")) || undefined,
  });
  revalidatePath(`/surveys/${id}`);
  revalidatePath("/surveys");
}

export async function deleteSurvey(id: string) {
  const db = getDataProvider();
  const [questions, responses] = await Promise.all([
    db.surveyQuestions.list(),
    db.surveyResponses.list(),
  ]);
  await Promise.all([
    ...questions.filter((q) => q.surveyId === id).map((q) => db.surveyQuestions.remove(q.id)),
    ...responses.filter((r) => r.surveyId === id).map((r) => db.surveyResponses.remove(r.id)),
  ]);
  await db.surveys.remove(id);
  revalidatePath("/surveys");
  redirect("/surveys");
}

export async function addSurveyQuestion(surveyId: string, formData: FormData) {
  const db = getDataProvider();
  const type = parseQType(formData.get("type"));
  const existing = (await db.surveyQuestions.list()).filter((q) => q.surveyId === surveyId);
  const options =
    type === "select"
      ? str(formData.get("options"))
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  await db.surveyQuestions.create({
    id: uid("sq"),
    surveyId,
    label: str(formData.get("label")) || "設問",
    type,
    order: existing.length,
    options,
  });
  revalidatePath(`/surveys/${surveyId}`);
}

export async function deleteSurveyQuestion(questionId: string, surveyId: string) {
  await getDataProvider().surveyQuestions.remove(questionId);
  revalidatePath(`/surveys/${surveyId}`);
}

export async function moveSurveyQuestion(questionId: string, surveyId: string, dir: "up" | "down") {
  const db = getDataProvider();
  const qs = (await db.surveyQuestions.list())
    .filter((q) => q.surveyId === surveyId)
    .sort((a, b) => a.order - b.order);
  const idx = qs.findIndex((q) => q.id === questionId);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= qs.length) return;
  await db.surveyQuestions.update(qs[idx].id, { order: qs[swap].order });
  await db.surveyQuestions.update(qs[swap].id, { order: qs[idx].order });
  revalidatePath(`/surveys/${surveyId}`);
}

/** 公開アンケートの送信（§5 回答時タグ付け）。 */
export async function submitSurveyResponse(surveyId: string, formData: FormData) {
  const db = getDataProvider();
  const survey = await db.surveys.get(surveyId);
  if (!survey) redirect("/");
  const questions: SurveyQuestion[] = (await db.surveyQuestions.list()).filter(
    (q) => q.surveyId === surveyId
  );

  const values: Record<string, string | number> = {};
  for (const q of questions) {
    const raw = str(formData.get(q.id));
    if (!raw) continue;
    values[q.id] = q.type === "rating5" ? Number(raw) : raw;
  }
  const friendId = str(formData.get("u")) || undefined;

  await db.surveyResponses.create({
    id: uid("sres"),
    surveyId,
    friendId,
    values,
    createdAt: new Date().toISOString(),
  });

  if (survey.autoTagId && friendId) {
    const fts = await db.friendTags.list();
    if (!fts.some((ft) => ft.friendId === friendId && ft.tagId === survey.autoTagId)) {
      await db.friendTags.create({
        id: uid("ft"),
        friendId,
        tagId: survey.autoTagId,
        auto: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  revalidatePath(`/surveys/${surveyId}`);
  redirect(`/s/${surveyId}?submitted=1`);
}
