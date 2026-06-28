import { getDataProvider } from "@/lib/data/provider";
import type { AiCharacter } from "@/lib/data/types";

export async function listAiCharacters(): Promise<AiCharacter[]> {
  return (await getDataProvider().aiCharacters.list()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1
  );
}

export async function getAiCharacter(id: string): Promise<AiCharacter | null> {
  return getDataProvider().aiCharacters.get(id);
}
