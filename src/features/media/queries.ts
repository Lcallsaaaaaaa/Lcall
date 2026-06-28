import { getDataProvider } from "@/lib/data/provider";
import type { MediaAsset } from "@/lib/data/types";

export async function listMedia(): Promise<MediaAsset[]> {
  return (await getDataProvider().mediaAssets.list()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}
