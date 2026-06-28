import { getDataProvider } from "@/lib/data/provider";
import type { User } from "@/lib/data/types";

export async function listUsers(): Promise<User[]> {
  return (await getDataProvider().users.list()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1
  );
}
