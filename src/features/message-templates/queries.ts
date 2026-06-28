import { getDataProvider } from "@/lib/data/provider";
import type { MessageTemplate } from "@/lib/data/types";

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  return (await getDataProvider().messageTemplates.list()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1
  );
}
