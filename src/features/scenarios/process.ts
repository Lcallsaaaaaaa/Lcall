import type { DataProvider } from "@/lib/data/repository";
import type { ScenarioStep } from "@/lib/data/types";
import { isRealToken, pushCarousel, pushText } from "@/lib/line";
import { isOperationsSuspended } from "@/lib/operator";
import { trackingUrl } from "@/lib/tracking";
import { applyFriendVars } from "@/lib/vars";
import { conditionMet, dueSteps } from "./engine";

interface CarouselCardLite {
  title: string;
  description: string;
  imageUrl: string;
  buttonLabel: string;
  trackingId: string;
}

/**
 * 配信すべきシナリオステップを処理する（追加時挨拶＋経過時間ステップ）。
 * - 対象 = active シナリオ × 対象タグ一致 × active 友だち
 * - 各ステップ: 経過時間到達かつ未送信なら配信実績を記録し、本物トークンなら push、付与タグを適用
 * - 重複送信は scenario_deliveries で防止
 *
 * webhook(follow) では friendId 指定で追加時挨拶を即時送信、cron では全体を処理する。
 */
export async function processScenarios(
  db: DataProvider,
  opts: { friendId?: string; scenarioId?: string; now?: Date } = {}
): Promise<{ sent: number }> {
  const now = opts.now ?? new Date();
  // 運営により一時停止中はシナリオ配信を行わない（遠隔操作）。
  if (await isOperationsSuspended(db)) return { sent: 0 };
  const [scenarios, steps, deliveries, friends, friendTags, accounts, carouselCards, redirectLinks] =
    await Promise.all([
      db.scenarios.list(),
      db.scenarioSteps.list(),
      db.scenarioDeliveries.list(),
      db.friends.list(),
      db.friendTags.list(),
      db.lineAccounts.list(),
      db.carouselCards.list(),
      db.redirectLinks.list(),
    ]);

  // カルーセルステップ用: 配信ID → カード（trackingId付き）
  const linkTrk = new Map(redirectLinks.map((l) => [l.id, l.trackingId]));
  const cardsByBroadcast = new Map<string, CarouselCardLite[]>();
  for (const c of [...carouselCards].sort((a, b) => a.order - b.order)) {
    const arr = cardsByBroadcast.get(c.broadcastId) ?? [];
    arr.push({
      title: c.title,
      description: c.description,
      imageUrl: c.imageUrl,
      buttonLabel: c.buttonLabel,
      trackingId: linkTrk.get(c.redirectLinkId) ?? "",
    });
    cardsByBroadcast.set(c.broadcastId, arr);
  }

  const activeScenarios = scenarios.filter(
    (s) => s.status === "active" && (!opts.scenarioId || s.id === opts.scenarioId)
  );

  const stepsByScenario = new Map<string, ScenarioStep[]>();
  for (const st of steps) {
    const arr = stepsByScenario.get(st.scenarioId) ?? [];
    arr.push(st);
    stepsByScenario.set(st.scenarioId, arr);
  }
  for (const arr of stepsByScenario.values()) arr.sort((a, b) => a.order - b.order);

  const tagsByFriend = new Map<string, Set<string>>();
  for (const ft of friendTags) {
    const s = tagsByFriend.get(ft.friendId) ?? new Set<string>();
    s.add(ft.tagId);
    tagsByFriend.set(ft.friendId, s);
  }
  const friendTagKeys = new Set(friendTags.map((ft) => `${ft.friendId}:${ft.tagId}`));

  const deliveredByFriend = new Map<string, Set<string>>();
  for (const d of deliveries) {
    const s = deliveredByFriend.get(d.friendId) ?? new Set<string>();
    s.add(d.stepId);
    deliveredByFriend.set(d.friendId, s);
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const targetFriends = opts.friendId ? friends.filter((f) => f.id === opts.friendId) : friends;

  let sent = 0;
  for (const scenario of activeScenarios) {
    const sSteps = stepsByScenario.get(scenario.id) ?? [];
    if (sSteps.length === 0) continue;

    for (const f of targetFriends) {
      if (f.status !== "active") continue;
      if (scenario.targetTagId && !tagsByFriend.get(f.id)?.has(scenario.targetTagId)) continue;

      const delivered = deliveredByFriend.get(f.id) ?? new Set<string>();
      deliveredByFriend.set(f.id, delivered);
      const fTags = tagsByFriend.get(f.id) ?? new Set<string>();
      tagsByFriend.set(f.id, fTags);

      for (const step of dueSteps(sSteps, f.registeredAt, now, delivered)) {
        // 配信条件（タグ分岐）を評価。直前ステップで付与したタグも反映される
        const hasTag = step.conditionTagId ? fTags.has(step.conditionTagId) : false;
        const willSend = conditionMet(step.conditionMode, step.conditionTagId, hasTag);

        await db.scenarioDeliveries.create({
          id: `sd_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
          scenarioId: scenario.id,
          stepId: step.id,
          friendId: f.id,
          sent: willSend,
          sentAt: now.toISOString(),
        });
        delivered.add(step.id);
        if (!willSend) continue; // 条件不一致はスキップ（記録済みなので再評価しない）

        const acc = accountById.get(f.lineAccountId);
        if (acc && isRealToken(acc.channelAccessToken)) {
          if (step.carouselBroadcastId) {
            const cards = cardsByBroadcast.get(step.carouselBroadcastId) ?? [];
            if (cards.length > 0) {
              await pushCarousel(
                acc.channelAccessToken,
                f.lineUserId,
                applyFriendVars(step.text || "カルーセル", f),
                cards.map((c) => ({
                  thumbnailImageUrl: c.imageUrl || undefined,
                  title: c.title,
                  text: c.description,
                  uri: trackingUrl(c.trackingId, f.id),
                  label: c.buttonLabel,
                }))
              );
            }
          } else {
            await pushText(acc.channelAccessToken, f.lineUserId, applyFriendVars(step.text, f));
          }
        }
        if (step.autoTagId) {
          const key = `${f.id}:${step.autoTagId}`;
          if (!friendTagKeys.has(key)) {
            friendTagKeys.add(key);
            fTags.add(step.autoTagId);
            await db.friendTags.create({
              id: `ft_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
              friendId: f.id,
              tagId: step.autoTagId,
              auto: true,
              createdAt: now.toISOString(),
            });
          }
        }
        sent++;
      }
    }
  }
  return { sent };
}
