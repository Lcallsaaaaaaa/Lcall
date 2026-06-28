import { SESSION_COOKIE } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST() {
  const res = redirectTo("/login");
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
