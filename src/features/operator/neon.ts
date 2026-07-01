/**
 * Neon API クライアント（②マルチテナント：クライアント別DBの自動作成）。
 *
 * 運営コンソール（コントロールプレーン）でのみ使用。API キー等は運営 env に置き、
 * クライアントには一切渡さない（運営だけがDBを量産できる）。
 *
 * 必要 env:
 *   NEON_API_KEY      Neon の API キー（Bearer）
 *   NEON_PROJECT_ID   対象プロジェクトID
 *   NEON_BRANCH_ID    （任意）作成先ブランチ。未指定なら既定（primary）を自動取得
 *   NEON_ROLE_NAME    （任意）DBオーナーのロール名。未指定なら既定ロールを自動取得
 *
 * これらが未設定なら neonEnabled()=false。プロビジョニングは「手動モード」に退避する。
 */

const NEON_API = "https://console.neon.tech/api/v2";

function apiKey(): string | undefined {
  return process.env.NEON_API_KEY?.trim() || undefined;
}
function projectId(): string | undefined {
  return process.env.NEON_PROJECT_ID?.trim() || undefined;
}

/** Neon による自動プロビジョニングが使えるか。 */
export function neonEnabled(): boolean {
  return !!apiKey() && !!projectId();
}

interface NeonResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

async function neon<T = any>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: Record<string, unknown>
): Promise<NeonResult<T>> {
  const key = apiKey();
  if (!key) return { ok: false, status: 0, data: null, error: "NEON_API_KEY 未設定" };
  try {
    const res = await fetch(`${NEON_API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: String(e) };
  }
}

/** 既定（primary）ブランチIDを取得（env 指定があればそれ）。 */
async function resolveBranchId(pid: string): Promise<string> {
  const env = process.env.NEON_BRANCH_ID?.trim();
  if (env) return env;
  const r = await neon<{ branches: Array<{ id: string; primary?: boolean; default?: boolean }> }>(
    "GET",
    `/projects/${pid}/branches`
  );
  if (!r.ok || !r.data?.branches?.length) throw new Error(`Neon: ブランチ取得失敗（${r.error ?? "空"}）`);
  const branches = r.data.branches;
  const primary = branches.find((b) => b.primary || b.default) ?? branches[0];
  return primary.id;
}

/** DBオーナーのロール名を取得（env 指定があればそれ）。 */
async function resolveRoleName(pid: string, branchId: string): Promise<string> {
  const env = process.env.NEON_ROLE_NAME?.trim();
  if (env) return env;
  const r = await neon<{ roles: Array<{ name: string }> }>(
    "GET",
    `/projects/${pid}/branches/${branchId}/roles`
  );
  if (!r.ok || !r.data?.roles?.length) throw new Error(`Neon: ロール取得失敗（${r.error ?? "空"}）`);
  return r.data.roles[0].name;
}

/** Neon の DB 名（英小文字・数字・アンダースコア）。 */
function dbNameForSlug(slug: string): string {
  return `lcall_${slug.replace(/[^a-z0-9]+/g, "_")}`.slice(0, 60);
}

export interface ProvisionedDb {
  databaseUrl: string;
  dbName: string;
  branchId: string;
  roleName: string;
}

/**
 * クライアント専用DBを作成し、プール接続URL（Pooled・pgbouncer）を返す。
 * 既に同名DBがある場合は作成をスキップして接続URLだけ取得する（冪等）。
 */
export async function provisionNeonDatabase(slug: string): Promise<ProvisionedDb> {
  const pid = projectId();
  if (!apiKey() || !pid) throw new Error("Neon 未設定（NEON_API_KEY / NEON_PROJECT_ID）");

  const branchId = await resolveBranchId(pid);
  const roleName = await resolveRoleName(pid, branchId);
  const dbName = dbNameForSlug(slug);

  // DB 作成（既存なら 409 等 → 続行して接続URLを取得）
  const created = await neon("POST", `/projects/${pid}/branches/${branchId}/databases`, {
    database: { name: dbName, owner_name: roleName },
  });
  if (!created.ok && created.status !== 409 && created.status !== 422) {
    // 409/422 は「既に存在」相当として許容。それ以外は失敗。
    throw new Error(`Neon: DB作成失敗（${created.error ?? created.status}）`);
  }

  // Pooled 接続URLを取得（多テナントの接続枯渇回避。コードは prepare:false 済み）
  const uri = await neon<{ uri: string }>(
    "GET",
    `/projects/${pid}/connection_uri?branch_id=${encodeURIComponent(branchId)}&database_name=${encodeURIComponent(
      dbName
    )}&role_name=${encodeURIComponent(roleName)}&pooled=true`
  );
  if (!uri.ok || !uri.data?.uri) throw new Error(`Neon: 接続URI取得失敗（${uri.error ?? "空"}）`);

  return { databaseUrl: uri.data.uri, dbName, branchId, roleName };
}
