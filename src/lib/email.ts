/**
 * メール送信（任意機能）。Resend の HTTP API を使う（依存追加なし・fetch のみ）。
 * 環境変数が未設定なら送らず { ok:false, skipped:true } を返す（呼び出し側は気にせず呼べる）。
 *   RESEND_API_KEY … Resend の APIキー
 *   LCALL_MAIL_FROM … 差出人（例 "予約 <noreply@yourdomain.com>"。未設定は onboarding@resend.dev）
 */
export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; skipped?: boolean; detail?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, skipped: true };
  const from = process.env.LCALL_MAIL_FROM?.trim() || "LCall <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [args.to], subject: args.subject, text: args.text }),
    });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 200) };
  }
}
