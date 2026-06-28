import { getDataProvider } from "@/lib/data/provider";
import type { DataProvider } from "@/lib/data/repository";
import type {
  Broadcast,
  BroadcastTemplate,
  CarouselCard,
  Friend,
  RedirectLink,
  Tag,
} from "@/lib/data/types";
import { trackingUrl } from "@/lib/tracking";

export interface BroadcastRow extends Broadcast {
  lineAccountName?: string;
  targetTagNames: string[];
  cardCount: number;
}

export interface CardView extends CarouselCard {
  trackingId: string;
  trackingUrl: string;
  targetUrl: string;
  autoTagId?: string;
  autoTagName?: string;
  adCode?: string;
}

export interface BroadcastDetail {
  broadcast: Broadcast;
  lineAccountName?: string;
  targetTags: Tag[];
  cards: CardView[];
  /** url 種別の計測リンク */
  urlLink?: {
    trackingId: string;
    trackingUrl: string;
    targetUrl: string;
    openExternalBrowser: boolean;
    autoTagId?: string;
    autoTagName?: string;
    adCode?: string;
  };
  recipientEstimate: number;
}

/** 配信対象の友だちを解決（タグ条件 × 送信元LINE × 非ブロック）。 */
export async function resolveRecipients(
  db: DataProvider,
  targetTagIds: string[],
  lineAccountId?: string
): Promise<Friend[]> {
  const [friends, friendTags] = await Promise.all([db.friends.list(), db.friendTags.list()]);
  const tagsByFriend = new Map<string, Set<string>>();
  for (const ft of friendTags) {
    const s = tagsByFriend.get(ft.friendId) ?? new Set();
    s.add(ft.tagId);
    tagsByFriend.set(ft.friendId, s);
  }
  return friends.filter((f) => {
    if (f.status !== "active") return false;
    if (lineAccountId && f.lineAccountId !== lineAccountId) return false;
    if (targetTagIds.length > 0) {
      const owned = tagsByFriend.get(f.id);
      if (!owned || !targetTagIds.some((t) => owned.has(t))) return false;
    }
    return true;
  });
}

export async function listBroadcasts(): Promise<BroadcastRow[]> {
  const db = getDataProvider();
  const [broadcasts, accounts, tags, cards] = await Promise.all([
    db.broadcasts.list(),
    db.lineAccounts.list(),
    db.tags.list(),
    db.carouselCards.list(),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const cardCount = new Map<string, number>();
  for (const c of cards) cardCount.set(c.broadcastId, (cardCount.get(c.broadcastId) ?? 0) + 1);

  return broadcasts
    .map((b) => ({
      ...b,
      lineAccountName: b.lineAccountId ? accountName.get(b.lineAccountId) : undefined,
      targetTagNames: b.targetTagIds.map((id) => tagName.get(id) ?? id),
      cardCount: cardCount.get(b.id) ?? 0,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getBroadcast(id: string): Promise<BroadcastDetail | null> {
  const db = getDataProvider();
  const broadcast = await db.broadcasts.get(id);
  if (!broadcast) return null;

  const [accounts, tags, cards, links] = await Promise.all([
    db.lineAccounts.list(),
    db.tags.list(),
    db.carouselCards.list(),
    db.redirectLinks.list(),
  ]);
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const linkById = new Map(links.map((l) => [l.id, l]));

  const cardViews: CardView[] = cards
    .filter((c) => c.broadcastId === id)
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const link = linkById.get(c.redirectLinkId);
      const trackingId = link?.trackingId ?? "";
      return {
        ...c,
        trackingId,
        trackingUrl: trackingId ? trackingUrl(trackingId) : "",
        targetUrl: link?.targetUrl ?? "",
        autoTagId: link?.autoTagId,
        autoTagName: link?.autoTagId ? tagById.get(link.autoTagId)?.name : undefined,
        adCode: link?.adCode,
      };
    });

  let urlLink: BroadcastDetail["urlLink"];
  if (broadcast.type === "url") {
    const link = links.find((l) => l.broadcastId === id);
    if (link) {
      urlLink = {
        trackingId: link.trackingId,
        trackingUrl: trackingUrl(link.trackingId),
        targetUrl: link.targetUrl,
        openExternalBrowser: link.openExternalBrowser,
        autoTagId: link.autoTagId,
        autoTagName: link.autoTagId ? tagById.get(link.autoTagId)?.name : undefined,
        adCode: link.adCode,
      };
    }
  }

  return {
    broadcast,
    lineAccountName: broadcast.lineAccountId
      ? accounts.find((a) => a.id === broadcast.lineAccountId)?.name
      : undefined,
    targetTags: broadcast.targetTagIds.map((tid) => tagById.get(tid)).filter(Boolean) as Tag[],
    cards: cardViews,
    urlLink,
    recipientEstimate: (
      await resolveRecipients(db, broadcast.targetTagIds, broadcast.lineAccountId)
    ).length,
  };
}

export async function listTemplates(): Promise<BroadcastTemplate[]> {
  return (await getDataProvider().broadcastTemplates.list()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

/** url 種別の計測リンク（編集用に取得） */
export async function getUrlLink(broadcastId: string): Promise<RedirectLink | null> {
  const links = await getDataProvider().redirectLinks.list();
  return links.find((l) => l.broadcastId === broadcastId) ?? null;
}
