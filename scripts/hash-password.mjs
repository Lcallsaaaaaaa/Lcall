#!/usr/bin/env node
/**
 * パスワードを scrypt ハッシュ化（`lib/auth.ts` と同形式）。
 * 出力を .env の LCALL_ADMIN_PASSWORD_HASH に設定する。パスワード変更時にも使用。
 *
 *   node scripts/hash-password.mjs '<パスワード>'
 *   npm run hash-password -- '<パスワード>'
 */
import { randomBytes, scryptSync } from "node:crypto";

const plain = process.argv[2];
if (!plain) {
  console.error("使い方: node scripts/hash-password.mjs '<パスワード>'");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(plain, salt, 64);
console.log(`scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
