/**
 * Anthropic Messages API クライアント（AI自動応答用）。
 * Node ランタイム前提。SDK 非依存（fetch 直叩き）。
 * APIキーは環境変数 ANTHROPIC_API_KEY、またはアカウント別キーで上書き。
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
/** 既定モデル（自動応答は速くて安い Haiku を既定に）。 */
export const DEFAULT_AI_MODEL = "claude-haiku-4-5";

/** 利用可能なモデル（UIのセレクト用）。 */
export const AI_MODELS: { id: string; label: string }[] = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5（高速・低コスト／推奨）" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6（バランス）" },
  { id: "claude-opus-4-8", label: "Opus 4.8（最高品質）" },
];

/** アカウント別キー → 環境変数の順で APIキーを解決。 */
export function resolveAiApiKey(accountKey?: string | null): string | undefined {
  const k = (accountKey ?? "").trim();
  if (k) return k;
  const env = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  return env || undefined;
}

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

/** キャラ名＋ペルソナ＋FAQ から system プロンプトを組み立てる。 */
export function buildSystemPrompt(opts: { name?: string; instruction?: string; faq?: string }): string {
  const intro = opts.name?.trim()
    ? `あなたはLINE公式アカウントのカスタマーサポート担当「${opts.name.trim()}」です。一貫してこの人物として振る舞ってください。`
    : "あなたはLINE公式アカウントのカスタマーサポート担当者です。";
  const parts: string[] = [
    `${intro}日本語で、簡潔で丁寧に、LINEメッセージとして自然な長さ（2〜4文程度）で返信してください。`,
    "事実が不明な場合は推測せず、「担当者を確認して折り返します」と案内してください。決済・個人情報・契約変更など重要操作は自分で実行せず、担当者へ引き継ぐよう案内してください。",
  ];
  if (opts.instruction?.trim()) {
    parts.push(`# 性格・口調・ルール\n${opts.instruction.trim()}`);
  }
  if (opts.faq?.trim()) {
    parts.push(`# 業務知識・FAQ（この範囲で回答）\n${opts.faq.trim()}`);
  }
  return parts.join("\n\n");
}

/**
 * Claude にメッセージ列を渡して返信文を生成する。
 * 失敗時は ok:false（呼び出し側でフォールバック）。
 */
export async function generateAiReply(params: {
  apiKey: string;
  system: string;
  messages: AiTurn[];
  model?: string;
  maxTokens?: number;
}): Promise<{ ok: boolean; text?: string; status: number; error?: string }> {
  if (params.messages.length === 0) return { ok: false, status: 0, error: "no messages" };
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model || DEFAULT_AI_MODEL,
        max_tokens: params.maxTokens ?? 500,
        system: params.system,
        messages: params.messages,
      }),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text().catch(() => "") };
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return { ok: false, status: res.status, error: "empty completion" };
    return { ok: true, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}
