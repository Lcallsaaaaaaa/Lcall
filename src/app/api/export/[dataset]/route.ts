import { getSession } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { getDataProvider } from "@/lib/data/provider";

function fmtDt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 管理画面のデータCSV出力（§5 CSV出力）。要ログイン。 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> }
) {
  if (!(await getSession())) return new Response("unauthorized", { status: 401 });

  const { dataset } = await params;
  const url = new URL(request.url);
  const db = getDataProvider();

  if (dataset === "friends") {
    const [friends, accounts, tags, friendTags, chatMessages, targets, broadcasts, adCodes] =
      await Promise.all([
        db.friends.list(),
        db.lineAccounts.list(),
        db.tags.list(),
        db.friendTags.list(),
        db.chatMessages.list(),
        db.broadcastTargets.list(),
        db.broadcasts.list(),
        db.adCodes.list(),
      ]);
    const accName = new Map(accounts.map((a) => [a.id, a.name]));
    const adLabel = new Map(adCodes.map((a) => [a.code, a.label]));
    const sortedTags = [...tags].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    const tagsByFriend = new Map<string, Set<string>>();
    for (const ft of friendTags) {
      const s = tagsByFriend.get(ft.friendId) ?? new Set<string>();
      s.add(ft.tagId);
      tagsByFriend.set(ft.friendId, s);
    }
    // 最終アクセス用：友だちからの最終受信メッセージ時刻
    const lastInbound = new Map<string, string>();
    for (const m of chatMessages) {
      if (m.direction !== "in") continue;
      const cur = lastInbound.get(m.friendId);
      if (!cur || cur < m.createdAt) lastInbound.set(m.friendId, m.createdAt);
    }
    // 最終配信日：その友だちが受信した配信の最新 sentAt
    const sentAtByBroadcast = new Map(broadcasts.map((b) => [b.id, b.sentAt]));
    const lastBroadcast = new Map<string, string>();
    for (const t of targets) {
      const sa = sentAtByBroadcast.get(t.broadcastId);
      if (!sa) continue;
      const cur = lastBroadcast.get(t.friendId);
      if (!cur || cur < sa) lastBroadcast.set(t.friendId, sa);
    }

    const statusLabel: Record<string, string> = {
      active: "有効",
      blocked: "ブロック",
      unsubscribed: "解除",
    };
    const maxStr = (a?: string, b?: string) => (a && b ? (a > b ? a : b) : a || b || "");

    const headers = [
      "ID",
      "表示名",
      "LINEユーザーID",
      "登録LINE",
      "ステータス",
      "LINE追加日時",
      "最終アクセス日時",
      "最終クリック日",
      "ブロック日時",
      "最終配信日",
      "流入元",
      "LTV",
      ...sortedTags.map((t) => t.name),
    ];
    const rows = friends.map((f) => {
      const owned = tagsByFriend.get(f.id) ?? new Set<string>();
      return [
        f.id,
        f.displayName,
        f.lineUserId,
        accName.get(f.lineAccountId) ?? f.lineAccountId,
        statusLabel[f.status] ?? f.status,
        fmtDt(f.registeredAt),
        fmtDt(maxStr(f.lastClickAt, lastInbound.get(f.id))),
        fmtDt(f.lastClickAt),
        fmtDt(f.blockedAt),
        fmtDt(lastBroadcast.get(f.id)),
        f.sourceCode ? (adLabel.get(f.sourceCode) ?? f.sourceCode) : "",
        f.ltv,
        ...sortedTags.map((t) => (owned.has(t.id) ? "1" : "")),
      ];
    });
    return csvResponse("friends.csv", toCsv(headers, rows));
  }

  if (dataset === "clicks") {
    const [clicks, friends, broadcasts, links] = await Promise.all([
      db.clickLogs.list(),
      db.friends.list(),
      db.broadcasts.list(),
      db.redirectLinks.list(),
    ]);
    const fname = new Map(friends.map((f) => [f.id, f.displayName]));
    const btitle = new Map(broadcasts.map((b) => [b.id, b.title]));
    const trk = new Map(links.map((l) => [l.id, l.trackingId]));
    const csv = toCsv(
      ["ID", "日時", "顧客", "配信", "trackingId"],
      clicks.map((c) => [
        c.id,
        c.clickedAt,
        c.friendId ? (fname.get(c.friendId) ?? c.friendId) : "",
        c.broadcastId ? (btitle.get(c.broadcastId) ?? c.broadcastId) : "",
        trk.get(c.redirectLinkId) ?? c.redirectLinkId,
      ])
    );
    return csvResponse("clicks.csv", csv);
  }

  if (dataset === "broadcasts") {
    const broadcasts = await db.broadcasts.list();
    const csv = toCsv(
      ["ID", "タイトル", "種別", "状態", "送信数", "送信日時", "作成日時"],
      broadcasts.map((b) => [b.id, b.title, b.type, b.status, b.sentCount, b.sentAt ?? "", b.createdAt])
    );
    return csvResponse("broadcasts.csv", csv);
  }

  if (dataset === "form-responses") {
    const formId = url.searchParams.get("formId");
    const [fields, responses, friends] = await Promise.all([
      db.formFields.list(),
      db.formResponses.list(),
      db.friends.list(),
    ]);
    const fs = fields.filter((f) => f.formId === formId).sort((a, b) => a.order - b.order);
    const fname = new Map(friends.map((f) => [f.id, f.displayName]));
    const csv = toCsv(
      ["日時", "顧客", ...fs.map((f) => f.label)],
      responses
        .filter((r) => r.formId === formId)
        .map((r) => [
          r.createdAt,
          r.friendId ? (fname.get(r.friendId) ?? r.friendId) : "",
          ...fs.map((f) => r.values[f.id] ?? ""),
        ])
    );
    return csvResponse("form-responses.csv", csv);
  }

  if (dataset === "survey-responses") {
    const surveyId = url.searchParams.get("surveyId");
    const [questions, responses, friends] = await Promise.all([
      db.surveyQuestions.list(),
      db.surveyResponses.list(),
      db.friends.list(),
    ]);
    const qs = questions.filter((q) => q.surveyId === surveyId).sort((a, b) => a.order - b.order);
    const fname = new Map(friends.map((f) => [f.id, f.displayName]));
    const csv = toCsv(
      ["日時", "顧客", ...qs.map((q) => q.label)],
      responses
        .filter((r) => r.surveyId === surveyId)
        .map((r) => [
          r.createdAt,
          r.friendId ? (fname.get(r.friendId) ?? r.friendId) : "",
          ...qs.map((q) => (r.values[q.id] !== undefined ? String(r.values[q.id]) : "")),
        ])
    );
    return csvResponse("survey-responses.csv", csv);
  }

  return new Response("not found", { status: 404 });
}
