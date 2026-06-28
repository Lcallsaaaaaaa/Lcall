// PostgreSQL 接続 & アダプタSQLの単体チェック。
//   使い方: DATABASE_URL を .env.local 等に設定して `node scripts/db-check.mjs`
// lcall_kv を自動作成し、検証専用 entity("__selftest__") で INSERT/SELECT(順序)/UPDATE(jsonbマージ)/DELETE を確認。
// 本番データには触れません（専用 entity を使い、最後に後始末）。
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

// .env.local から DATABASE_URL を素朴に読む（未設定時のフォールバック）
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) {
        process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
        return;
      }
    }
  }
}

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が未設定です（.env.local に設定してください）");
  process.exit(1);
}

const sql = postgres(url, {
  ssl: process.env.PGSSL_DISABLE === "true" ? false : "require",
  prepare: false,
  max: 2,
  idle_timeout: 5,
  connect_timeout: 15,
});

const E = "__selftest__";
let ok = true;
const check = (label, cond) => {
  console.log(`${cond ? "OK " : "NG "} ${label}`);
  if (!cond) ok = false;
};

try {
  // スキーマ（アダプタと同一）
  await sql`
    create table if not exists lcall_kv (
      entity text not null, id text not null, data jsonb not null,
      seq bigserial, primary key (entity, id))`;
  await sql`create index if not exists lcall_kv_entity_seq on lcall_kv (entity, seq)`;

  // 後始末（前回の残り）
  await sql`delete from lcall_kv where entity = ${E}`;

  // create（2件・挿入順）
  for (const item of [
    { id: "a", name: "A", n: 1 },
    { id: "b", name: "B", n: 2 },
  ]) {
    await sql`insert into lcall_kv (entity, id, data)
      values (${E}, ${item.id}, ${sql.json(item)})
      on conflict (entity, id) do update set data = excluded.data`;
  }

  // list（seq 昇順＝挿入順）
  const listed = await sql`select data from lcall_kv where entity = ${E} order by seq`;
  check("挿入順で2件取得", listed.length === 2 && listed[0].data.id === "a" && listed[1].data.id === "b");

  // update（jsonb 浅いマージ。n は維持、name だけ更新）
  const upd = await sql`
    update lcall_kv
    set data = (data || ${sql.json({ name: "A2" })}::jsonb) || ${sql.json({ id: "a" })}::jsonb
    where entity = ${E} and id = ${"a"} returning data`;
  check("jsonbマージ更新（name変更・n維持）", upd[0].data.name === "A2" && upd[0].data.n === 1 && upd[0].data.id === "a");

  // get
  const got = await sql`select data from lcall_kv where entity = ${E} and id = ${"b"}`;
  check("id 指定取得", got.length === 1 && got[0].data.name === "B");

  // remove（returning で件数）
  const del = await sql`delete from lcall_kv where entity = ${E} and id = ${"a"} returning id`;
  check("削除で1件返る", del.count === 1);
  const after = await sql`select count(*)::int as c from lcall_kv where entity = ${E}`;
  check("削除後は残り1件", after[0].c === 1);

  // 後始末
  await sql`delete from lcall_kv where entity = ${E}`;
  console.log(ok ? "\n✅ DB接続・スキーマ・CRUD・jsonbマージ すべてOK" : "\n❌ 失敗あり（上記NG参照）");
} catch (e) {
  console.error("\n❌ エラー:", e?.message || e);
  ok = false;
} finally {
  await sql.end({ timeout: 5 });
}
process.exit(ok ? 0 : 1);
