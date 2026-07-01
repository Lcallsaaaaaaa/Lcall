import crypto from "node:crypto";
import { createPostgresProvider } from "@/lib/data/postgres-adapter";
import { getDataProvider } from "@/lib/data/provider";
import { buildEmptySeed } from "@/lib/data/seed";
import type { EntityName } from "@/lib/data/types";
import { localPgEnabled, provisionLocalPgDatabase } from "./localpg";
import { neonEnabled, provisionNeonDatabase } from "./neon";

/**
 * ②マルチテナントの自動開通（プロビジョニング）。
 *
 * 申込（or 運営）から呼ばれ、クライアント専用DBを用意し、そのDBに初期オーナーを作成し、
 * 台帳の ClientInstance に databaseUrl を書き込む。書き込んだ瞬間、動的レジストリ
 *（server.mjs が台帳から解決）経由で `<slug>.ドメイン` がそのテナント専用システムとして開通する。
 * → 再デプロイ・env手編集なしで「申込だけでシステムが自動生成」される。
 *
 * Neon 未設定（NEON_API_KEY 等なし）のときは「手動モード」に退避し、台帳に pending を立てる
 *（運営が後でDBを用意し databaseUrl を登録すれば開通）。アプリは壊さない。
 */

const ENTITY_NAMES = () => Object.keys(buildEmptySeed()) as EntityName[];

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** 平文を scrypt ハッシュ（auth.ts と同形式 `scrypt:salt:hash`）。 */
function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${crypto.scryptSync(plain, salt, 64).toString("hex")}`;
}

/** `<slug>.ドメイン` の公開URL（LCALL_TENANT_BASE_DOMAIN 未設定なら空）。 */
export function tenantBaseUrl(slug: string): string {
  const base = (process.env.LCALL_TENANT_BASE_DOMAIN || "").trim().toLowerCase();
  return base ? `https://${slug}.${base}` : "";
}

/** 自動プロビジョニング（専用DB作成）が使えるか。ローカルPG優先→Neon。 */
export function autoProvisionEnabled(): boolean {
  return localPgEnabled() || neonEnabled();
}

export interface ProvisionInput {
  clientAccountId: string;
  /** 初期オーナーの表示名（未指定はメール） */
  ownerName?: string;
  /** 初期オーナーの平文パスワード（申込フォームで本人が設定）。未指定なら自動生成し tempPassword を返す。 */
  password?: string;
}

export interface ProvisionOutcome {
  ok: boolean;
  mode: "localpg" | "neon" | "manual";
  databaseUrl?: string;
  baseUrl?: string;
  /** password 未指定で自動生成したときのみ（一度きり表示用） */
  tempPassword?: string;
  error?: string;
}

/** 台帳から対象クライアントのインスタンス行を取得（無ければ作成）。 */
async function findOrCreateInstance(clientAccountId: string, baseUrl: string) {
  const db = getDataProvider();
  const instances = await db.clientInstances.list();
  const existing = instances.find((i) => i.clientAccountId === clientAccountId);
  if (existing) return existing;
  const created = {
    id: uid("ci"),
    clientAccountId,
    baseUrl,
    operatorKey: crypto.randomBytes(24).toString("hex"),
    status: "unknown" as const,
    provisionStatus: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  await db.clientInstances.create(created);
  return created;
}

/**
 * テナントを開通する。Neon があれば専用DB作成＋オーナー作成＋台帳更新（全自動）。
 * 無ければ手動モード（pending）で台帳だけ整える。
 */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionOutcome> {
  const db = getDataProvider();
  const client = await db.clientAccounts.get(input.clientAccountId);
  if (!client) return { ok: false, mode: "manual", error: "クライアントが見つかりません" };

  const baseUrl = tenantBaseUrl(client.slug);
  const instance = await findOrCreateInstance(client.id, baseUrl);

  const useLocalPg = localPgEnabled();
  const useNeon = !useLocalPg && neonEnabled();
  const driver: "localpg" | "neon" | "manual" = useLocalPg ? "localpg" : useNeon ? "neon" : "manual";

  // 手動モード（自動プロビジョニング未設定）：pending を立てて終了。
  if (driver === "manual") {
    await db.clientInstances.update(instance.id, {
      baseUrl: baseUrl || instance.baseUrl,
      provisionStatus: "pending",
    });
    return { ok: true, mode: "manual", baseUrl };
  }

  await db.clientInstances.update(instance.id, { provisionStatus: "provisioning" });

  try {
    // 1) 専用DBを作成し 接続URLを取得（ローカルPG優先→Neon）
    const provisioned =
      driver === "localpg"
        ? await provisionLocalPgDatabase(client.slug)
        : await provisionNeonDatabase(client.slug);

    // 2) そのテナントDBに初期オーナーを作成（schema は初回アクセスで自動生成）
    const tenantDb = createPostgresProvider(ENTITY_NAMES(), provisioned.databaseUrl);
    const plain = input.password?.trim() || crypto.randomBytes(9).toString("base64url");
    const email = client.contactEmail.trim().toLowerCase();
    const existingUsers = await tenantDb.users.list();
    if (!existingUsers.some((u) => u.email.trim().toLowerCase() === email)) {
      await tenantDb.users.create({
        id: uid("u"),
        email: client.contactEmail,
        name: input.ownerName?.trim() || client.name || client.contactEmail,
        role: "owner",
        passwordHash: hashPassword(plain),
        createdAt: new Date().toISOString(),
      });
    }
    // プラン設定をテナントDBに反映（機能ゲート・上限の単一情報源）
    const settings = await tenantDb.systemSettings.list();
    const planRow = settings.find((s) => s.key === "plan");
    if (planRow) await tenantDb.systemSettings.update(planRow.id, { value: client.plan });
    else await tenantDb.systemSettings.create({ id: uid("set"), key: "plan", value: client.plan });

    // 3) 台帳のインスタンスに databaseUrl を書き込み＝この瞬間に開通（動的レジストリが解決）
    await db.clientInstances.update(instance.id, {
      databaseUrl: provisioned.databaseUrl,
      baseUrl: baseUrl || instance.baseUrl,
      provisionStatus: "ready",
      provisionRef: provisioned.dbName,
      status: "unknown",
    });

    return {
      ok: true,
      mode: driver,
      databaseUrl: provisioned.databaseUrl,
      baseUrl,
      tempPassword: input.password?.trim() ? undefined : plain,
    };
  } catch (e) {
    await db.clientInstances.update(instance.id, { provisionStatus: "failed" });
    return { ok: false, mode: driver, baseUrl, error: String(e instanceof Error ? e.message : e) };
  }
}
