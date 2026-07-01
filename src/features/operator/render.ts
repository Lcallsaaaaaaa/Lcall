/**
 * Render API 連携（②マルチテナント：クライアントのサブドメインを自動登録）。
 *
 * Render のワイルドカードカスタムドメインは証明書は出るが、各サブドメインを“個別登録”しないと
 * 実際には配信されない（未登録は Cloudflare Error 1000）。そこで申込（プロビジョニング）時に
 * `<slug>.lcall.shop` を Render のクライアント用サービス（②）へ API で自動登録する。
 *
 * 必要 env（運営＝コントロールプレーンのみ）:
 *   RENDER_API_KEY            Render の API キー（Account Settings → API Keys）
 *   RENDER_TENANT_SERVICE_ID  クライアント用サービス(②)のID（srv-...）
 *
 * 未設定なら renderDomainAutoEnabled()=false（VPS等・自動登録不要な構成では何もしない）。
 */

const RENDER_API = "https://api.render.com/v1";

function apiKey(): string | undefined {
  return process.env.RENDER_API_KEY?.trim() || undefined;
}
function tenantServiceId(): string | undefined {
  return process.env.RENDER_TENANT_SERVICE_ID?.trim() || undefined;
}

/** Render へのサブドメイン自動登録が使えるか。 */
export function renderDomainAutoEnabled(): boolean {
  return !!apiKey() && !!tenantServiceId();
}

/**
 * クライアント用サービス(②)に `<hostname>`（例 ski-1.lcall.shop）をカスタムドメインとして登録。
 * 既に登録済み（409/422）は成功扱い＝冪等。DNS はワイルドカードで解決済みのため即配信される。
 */
export async function addTenantCustomDomain(hostname: string): Promise<{ ok: boolean; error?: string }> {
  const key = apiKey();
  const svc = tenantServiceId();
  if (!key || !svc) return { ok: false, error: "RENDER_API_KEY / RENDER_TENANT_SERVICE_ID 未設定" };
  try {
    const res = await fetch(`${RENDER_API}/services/${svc}/custom-domains`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ name: hostname }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 409 || res.status === 422) return { ok: true }; // 既に登録済み
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}
