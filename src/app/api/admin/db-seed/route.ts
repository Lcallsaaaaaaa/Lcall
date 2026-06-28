import { getSession } from "@/lib/auth";
import { getDataProvider } from "@/lib/data/provider";
import { seedProvider } from "@/lib/data/seed-runner";
import { buildEmptySeed, buildSeed } from "@/lib/data/seed";
import { workerKey } from "@/lib/tracking";

export const runtime = "nodejs";

/**
 * DB へシードを投入する管理用エンドポイント（postgres など永続アダプタの初期化）。
 *   - cron/管理: POST /api/admin/db-seed?key={LCALL_WORKER_KEY}&mode=empty|demo
 *   - ログイン中（owner）なら key 不要
 *
 * mode:
 *   - "empty"（既定）: 何も投入しない（空のまま運用＝実クライアント向け）。スキーマ作成のみ。
 *   - "demo": デモ用シードを投入（検証用）。
 *
 * 既にデータがあるエンティティは**スキップ**するため、本番データを上書きしない。
 */
async function run(request: Request) {
  const url = new URL(request.url);
  const keyOk = url.searchParams.get("key") === workerKey();
  const session = await getSession();
  if (!keyOk && !(session && session.role === "owner")) {
    return new Response("unauthorized", { status: 401 });
  }

  const mode = url.searchParams.get("mode") === "demo" ? "demo" : "empty";
  const provider = getDataProvider();
  const seed = mode === "demo" ? buildSeed() : buildEmptySeed();
  const result = await seedProvider(provider, seed);

  return Response.json({ ok: true, mode, ...result });
}

export async function POST(request: Request) {
  return run(request);
}
