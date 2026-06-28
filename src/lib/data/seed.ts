import type {
  EntityMap,
  EntityName,
  Friend,
  LineAccount,
  Tag,
} from "./types";

/** 決定論的PRNG（seed固定でダミーを安定させる） */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ローカル日付の年月日時から ISO 文字列を作る */
function iso(y: number, m: number, d: number, h = 9, min = 0): string {
  return new Date(y, m, d, h, min, 0).toISOString();
}

function pickWeighted<T>(rng: () => number, items: { item: T; weight: number }[]): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

type Seed = { [K in EntityName]: EntityMap[K][] };

/** 新規クライアント用の空シード（デモデータ無し・全エンティティ空配列）。LCALL_SEED=empty で使用。 */
export function buildEmptySeed(): Seed {
  const empty = {} as Record<EntityName, unknown[]>;
  for (const k of Object.keys(buildSeed()) as EntityName[]) empty[k] = [];
  return empty as Seed;
}

/**
 * デモ用シードを生成。`now` 基準で過去12か月＋当月＋本日に登録を散らすので、
 * 「本日の登録数」「今月の登録数」「登録月別推移」が常に意味のある値になる。
 */
export function buildSeed(now: Date = new Date()): Seed {
  const rng = mulberry32(20260626);
  const y = now.getFullYear();
  const mo = now.getMonth();
  const today = now.getDate();

  const lineAccounts: LineAccount[] = [
    mkAccount("la_1", "メイン窓口A", "active", 5000, 3),
    mkAccount("la_2", "メイン窓口B", "active", 5000, 2),
    mkAccount("la_3", "サポートC", "active", 3000, 1),
    mkAccount("la_4", "キャンペーンD", "warning", 2000, 1),
    mkAccount("la_5", "旧アカウントE", "paused", 1000, 0),
  ];

  // 登録の受け皿（停止中=paused は除外。warningは受ける）
  const receiving = lineAccounts
    .filter((a) => a.status === "active" || a.status === "warning")
    .map((a) => ({ item: a.id, weight: a.weight }));

  const tags: Tag[] = [
    mkTag("tg_1", "VIP", "#dd2a7b"),
    mkTag("tg_2", "新規", "#515bd4"),
    mkTag("tg_3", "未購入", "#b45309"),
    mkTag("tg_4", "セミナー参加", "#16a34a"),
    mkTag("tg_5", "休眠", "#6b7280"),
  ];

  // ---- friends（過去12か月＋当月） ----
  const adCodeValues = ["spring", "google", "insta"];
  const friends: Friend[] = [];
  let fid = 1;
  const pushFriend = (registeredAt: string) => {
    const lineAccountId = pickWeighted(rng, receiving);
    const hasLtv = rng() < 0.22;
    const id = `fr_${fid++}`;
    friends.push({
      id,
      lineUserId: `U${(1000000 + fid * 13).toString(16)}`,
      displayName: randomName(rng),
      lineAccountId,
      registeredAt,
      lastClickAt: rng() < 0.5 ? registeredAt : undefined,
      ltv: hasLtv ? Math.round((2000 + rng() * 48000) / 100) * 100 : 0,
      status: rng() < 0.06 ? "blocked" : "active",
      sourceCode: rng() < 0.3 ? adCodeValues[Math.floor(rng() * adCodeValues.length)] : undefined,
    });
  };

  // 過去11か月（成長カーブで増やす）
  for (let back = 11; back >= 1; back--) {
    const d = new Date(y, mo - back, 1);
    const yy = d.getFullYear();
    const mm = d.getMonth();
    const daysInMonth = new Date(yy, mm + 1, 0).getDate();
    const count = Math.round(18 + (11 - back) * 5 + rng() * 12);
    for (let i = 0; i < count; i++) {
      const day = 1 + Math.floor(rng() * daysInMonth);
      pushFriend(iso(yy, mm, day, 8 + Math.floor(rng() * 12), Math.floor(rng() * 60)));
    }
  }
  // 当月（本日まで）
  const thisMonthCount = Math.round(70 + rng() * 20);
  for (let i = 0; i < thisMonthCount; i++) {
    const day = 1 + Math.floor(rng() * today);
    pushFriend(iso(y, mo, day, 8 + Math.floor(rng() * 12), Math.floor(rng() * 60)));
  }
  // 本日（必ず数件）
  const todayCount = 7 + Math.floor(rng() * 7);
  for (let i = 0; i < todayCount; i++) {
    pushFriend(iso(y, mo, today, Math.floor(rng() * 10), Math.floor(rng() * 60)));
  }

  // ---- friend_tags（顧客一覧にタグを表示） ----
  const friendTags: EntityMap["friendTags"][] = [];
  let ftId = 1;
  const tagIds = tags.map((t) => t.id);
  for (const f of friends) {
    if (rng() >= 0.45) continue;
    const assigned = new Set<string>();
    const n = rng() < 0.3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const tagId = tagIds[Math.floor(rng() * tagIds.length)];
      if (assigned.has(tagId)) continue;
      assigned.add(tagId);
      friendTags.push({
        id: `ft_${ftId++}`,
        friendId: f.id,
        tagId,
        auto: tagId === "tg_3" || tagId === "tg_4", // クリック自動付与由来とみなす
        createdAt: f.registeredAt,
      });
    }
  }

  // ---- chat_messages（1:1 トーク対応） ----
  const chatMessages: EntityMap["chatMessages"][] = [];
  let cmId = 1;
  const inboundSamples = [
    "こんにちは、商品について質問があります。",
    "予約は可能ですか？",
    "ありがとうございました！",
    "料金を教えてください。",
    "キャンセルしたいのですが…",
    "無事に届きました、感謝します。",
  ];
  const outboundSamples = [
    "お問い合わせありがとうございます。",
    "はい、可能です。ご希望の日時はありますか？",
    "担当より追ってご連絡いたします。",
    "こちらの料金表をご覧ください。",
    "承知しました。手配いたします。",
  ];
  const staffNames = ["山田", "佐藤", "スタッフ"];
  const chatFriends = friends.slice(0, 14);
  chatFriends.forEach((f, fi) => {
    const count = 1 + Math.floor(rng() * 4);
    const base = new Date(now.getTime() - (fi * 3 + Math.floor(rng() * 20)) * 3600 * 1000);
    for (let m = 0; m < count; m++) {
      const isIn = m === 0 ? true : rng() < 0.5;
      chatMessages.push({
        id: `cm_${cmId++}`,
        friendId: f.id,
        direction: isIn ? "in" : "out",
        text: isIn
          ? inboundSamples[Math.floor(rng() * inboundSamples.length)]
          : outboundSamples[Math.floor(rng() * outboundSamples.length)],
        staffName: isIn ? undefined : staffNames[Math.floor(rng() * staffNames.length)],
        read: true,
        createdAt: new Date(base.getTime() + m * 30 * 60 * 1000).toISOString(),
      });
    }
  });
  // 直近の未読受信を数件（上位スレッドに表示される）
  for (let k = 0; k < 5; k++) {
    chatMessages.push({
      id: `cm_${cmId++}`,
      friendId: chatFriends[k].id,
      direction: "in",
      text: inboundSamples[Math.floor(rng() * inboundSamples.length)],
      read: false,
      createdAt: new Date(now.getTime() - k * 15 * 60 * 1000).toISOString(),
    });
  }

  // ---- broadcasts ----
  const broadcastTitles = [
    "6月キャンペーン告知",
    "新サービス案内（カルーセル）",
    "週末限定クーポン",
    "セミナー参加お礼",
    "アンケートご協力のお願い",
    "再入荷のお知らせ",
    "友だち限定LP公開",
    "休眠フォロー配信",
  ];
  const broadcasts: EntityMap["broadcasts"][] = broadcastTitles.map((title, i) => {
    const back = broadcastTitles.length - i;
    const d = new Date(y, mo, today - back * 3);
    const type = (["text", "carousel", "url"] as const)[i % 3];
    return {
      id: `bc_${i + 1}`,
      title,
      type,
      status: "sent",
      text: type === "carousel" ? undefined : `${title}のお知らせです。詳しくはこちら。`,
      targetTagIds: i % 2 === 0 ? ["tg_2"] : [],
      lineAccountId: undefined,
      sentAt: d.toISOString(),
      sentCount: 180 + Math.floor(rng() * 320),
      createdAt: d.toISOString(),
    };
  });
  const totalSent = broadcasts.reduce((s, b) => s + b.sentCount, 0);

  // ---- click_logs（総送信のおよそ23%がクリック想定） ----
  const clickLogs: EntityMap["clickLogs"][] = [];
  const totalClicks = Math.round(totalSent * 0.23);
  for (let i = 0; i < totalClicks; i++) {
    const bc = broadcasts[Math.floor(rng() * broadcasts.length)];
    const fr = friends[Math.floor(rng() * friends.length)];
    clickLogs.push({
      id: `cl_${i + 1}`,
      redirectLinkId: `rl_${1 + (i % 3)}`,
      friendId: fr.id,
      broadcastId: bc.id,
      clickedAt: bc.sentAt!,
    });
  }

  // ---- forms / responses ----
  const forms: EntityMap["forms"][] = [
    { id: "fm_1", title: "無料相談 申込フォーム", autoTagId: "tg_2", createdAt: iso(y, mo - 2, 3) },
    { id: "fm_2", title: "資料請求フォーム", createdAt: iso(y, mo - 1, 10) },
  ];
  const formFields: EntityMap["formFields"][] = [
    { id: "ff_1", formId: "fm_1", label: "お名前", type: "text", required: true, order: 0 },
    { id: "ff_2", formId: "fm_1", label: "メールアドレス", type: "email", required: true, order: 1 },
    { id: "ff_3", formId: "fm_1", label: "電話番号", type: "tel", required: false, order: 2 },
    { id: "ff_4", formId: "fm_1", label: "ご相談内容", type: "textarea", required: false, order: 3 },
    { id: "ff_5", formId: "fm_2", label: "お名前", type: "text", required: true, order: 0 },
    { id: "ff_6", formId: "fm_2", label: "メールアドレス", type: "email", required: true, order: 1 },
  ];
  const formResponses: EntityMap["formResponses"][] = [];
  const formRespCount = 60 + Math.floor(rng() * 30);
  for (let i = 0; i < formRespCount; i++) {
    const fr = friends[Math.floor(rng() * friends.length)];
    const toFm1 = rng() < 0.6;
    formResponses.push({
      id: `fres_${i + 1}`,
      formId: toFm1 ? "fm_1" : "fm_2",
      friendId: fr.id,
      values: toFm1
        ? { ff_1: fr.displayName, ff_2: "user@example.com", ff_3: "09000000000", ff_4: "資料を希望します。" }
        : { ff_5: fr.displayName, ff_6: "user@example.com" },
      createdAt: fr.registeredAt,
    });
  }

  // ---- surveys / responses ----
  const surveys: EntityMap["surveys"][] = [
    { id: "sv_1", title: "サービス満足度アンケート", autoTagId: "tg_4", createdAt: iso(y, mo - 1, 5) },
  ];
  const surveyQuestions: EntityMap["surveyQuestions"][] = [
    { id: "sq_1", surveyId: "sv_1", label: "総合満足度", type: "rating5", order: 0 },
    {
      id: "sq_2",
      surveyId: "sv_1",
      label: "利用のきっかけ",
      type: "select",
      order: 1,
      options: ["広告", "紹介", "検索", "その他"],
    },
    { id: "sq_3", surveyId: "sv_1", label: "ご意見・ご要望", type: "textarea", order: 2 },
  ];
  const surveyResponses: EntityMap["surveyResponses"][] = [];
  const surveyRespCount = 40 + Math.floor(rng() * 25);
  const kikkake = ["広告", "紹介", "検索", "その他"];
  for (let i = 0; i < surveyRespCount; i++) {
    const fr = friends[Math.floor(rng() * friends.length)];
    surveyResponses.push({
      id: `sres_${i + 1}`,
      surveyId: "sv_1",
      friendId: fr.id,
      values: {
        sq_1: 1 + Math.floor(rng() * 5),
        sq_2: kikkake[Math.floor(rng() * kikkake.length)],
      },
      createdAt: fr.registeredAt,
    });
  }

  return {
    users: [
      {
        id: "u_1",
        email: "owner@example.com",
        name: "オーナー",
        role: "owner",
        createdAt: iso(y, mo - 6, 1),
      },
    ],
    lineAccounts,
    richMenus: [
      {
        id: "rm_1",
        name: "メインメニュー（6分割）",
        lineAccountId: "la_1",
        size: "large",
        template: "large-2x3",
        chatBarText: "メニュー",
        imageUrl: "https://placehold.co/2500x1686?text=Rich+Menu",
        areas: [
          { action: "uri", label: "予約する", uri: "https://example.com/reserve" },
          { action: "uri", label: "メニュー", uri: "https://example.com/menu" },
          { action: "uri", label: "アクセス", uri: "https://example.com/access" },
          { action: "message", label: "クーポン", text: "クーポンをください" },
          { action: "message", label: "よくある質問", text: "よくある質問" },
          { action: "uri", label: "電話する", uri: "tel:0312345678" },
        ],
        isDefault: true,
        createdAt: iso(y, mo - 1, 3),
      },
    ],
    redirectLinks: [
      {
        id: "rl_1",
        trackingId: "trk_abc123",
        targetUrl: "https://example.com/lp",
        openExternalBrowser: true,
        autoTagId: "tg_4",
        createdAt: iso(y, mo - 1, 2),
      },
      {
        id: "rl_2",
        trackingId: "trk_def456",
        targetUrl: "https://example.com/coupon",
        openExternalBrowser: true,
        createdAt: iso(y, mo - 1, 8),
      },
      {
        id: "rl_3",
        trackingId: "trk_ghi789",
        targetUrl: "https://example.com/form",
        openExternalBrowser: true,
        autoTagId: "tg_3",
        createdAt: iso(y, mo, 1),
      },
      { id: "rl_c1", trackingId: "trk_card1", targetUrl: "https://example.com/service-a", openExternalBrowser: true, autoTagId: "tg_4", adCode: "spring", broadcastId: "bc_2", createdAt: iso(y, mo, 5) },
      { id: "rl_c2", trackingId: "trk_card2", targetUrl: "https://example.com/service-b", openExternalBrowser: true, broadcastId: "bc_2", createdAt: iso(y, mo, 5) },
    ],
    distributionLogs: [],
    friends,
    tags,
    friendTags,
    broadcasts,
    broadcastTemplates: [],
    broadcastTargets: [],
    carouselCards: [
      { id: "cc_1", broadcastId: "bc_2", order: 0, title: "サービスA", description: "人気No.1のプランです。", imageUrl: "https://placehold.co/600x400?text=Service+A", buttonLabel: "詳しく見る", redirectLinkId: "rl_c1", openExternalBrowser: true },
      { id: "cc_2", broadcastId: "bc_2", order: 1, title: "サービスB", description: "コスパ重視の方に。", imageUrl: "https://placehold.co/600x400?text=Service+B", buttonLabel: "詳しく見る", redirectLinkId: "rl_c2", openExternalBrowser: true },
    ],
    clickLogs,
    forms,
    formFields,
    formResponses,
    surveys,
    surveyQuestions,
    surveyResponses,
    landingPages: [
      {
        id: "lp_1",
        slug: "free-consult",
        title: "無料相談キャンペーン",
        description: "今だけ初回相談無料。お気軽にお申し込みください。",
        imageUrl: "",
        ctaLabel: "無料で相談する",
        formId: "fm_1",
        thanksMessage: "お申し込みありがとうございます。",
        createdAt: iso(y, mo - 1, 12),
      },
    ],
    ltvRecords: [],
    chatMessages,
    messageTemplates: [
      { id: "mt_1", title: "お礼", text: "お問い合わせありがとうございます。担当より確認のうえご連絡いたします。", createdAt: iso(y, mo - 1, 1) },
      { id: "mt_2", title: "営業時間案内", text: "営業時間は平日10:00〜18:00です。順次対応いたしますのでお待ちください。", createdAt: iso(y, mo - 1, 1) },
      { id: "mt_3", title: "予約確認", text: "ご予約ありがとうございます。日時のご希望をお知らせください。", createdAt: iso(y, mo - 1, 1) },
    ],
    aiCharacters: [
      {
        id: "chr_1",
        name: "サポートのあい",
        persona: "明るく親しみやすい20代の女性スタッフ風。丁寧だが堅すぎない口調。絵文字は控えめ。分からないことは無理に答えず担当者へ引き継ぐ。",
        faq: "Q: 営業時間は？\nA: 平日10:00〜18:00です。\nQ: 返品は？\nA: 到着後7日以内にご連絡ください。",
        model: "claude-haiku-4-5",
        createdAt: iso(y, mo - 1, 1),
      },
      {
        id: "chr_2",
        name: "コンシェルジュ司",
        persona: "落ち着いた丁寧な執事風。VIP顧客向けに上質で簡潔な敬語で対応する。",
        model: "claude-sonnet-4-6",
        createdAt: iso(y, mo - 1, 1),
      },
    ],
    adCodes: [
      { id: "ad_1", code: "spring", label: "春キャンペーン", createdAt: iso(y, mo - 2, 1) },
      { id: "ad_2", code: "google", label: "Google広告", createdAt: iso(y, mo - 2, 1) },
      { id: "ad_3", code: "insta", label: "Instagram広告", createdAt: iso(y, mo - 1, 1) },
    ],
    mediaAssets: [
      { id: "med_1", name: "キャンペーンバナー", url: "https://placehold.co/600x300?text=Campaign", createdAt: iso(y, mo - 1, 5) },
      { id: "med_2", name: "商品サムネイル", url: "https://placehold.co/600x400?text=Product", createdAt: iso(y, mo - 1, 8) },
    ],
    scenarios: [
      { id: "sc_1", name: "新規フォロー育成シナリオ", status: "active", createdAt: iso(y, mo - 1, 1) },
    ],
    scenarioSteps: [
      { id: "ss_1", scenarioId: "sc_1", order: 0, delayMinutes: 0, text: "友だち追加ありがとうございます！はじめまして、LCallです。", autoTagId: "tg_2" },
      { id: "ss_2", scenarioId: "sc_1", order: 1, delayMinutes: 1440, text: "昨日はご登録ありがとうございました。こちらが人気のサービスです。", imageUrl: "https://placehold.co/600x400?text=Product" },
      { id: "ss_3", scenarioId: "sc_1", order: 2, delayMinutes: 4320, text: "3日間限定の特典クーポンをお送りします！", autoTagId: "tg_1" },
    ],
    scenarioDeliveries: [],
    billingCustomers: [
      {
        id: "bill_1",
        stripeCustomerId: "cus_demo",
        plan: "standard",
        status: "active",
        nextBillingAt: iso(y, mo + 1, 1),
        createdAt: iso(y, mo - 6, 1),
      },
    ],
    invoices: [
      { id: "inv_1", billingCustomerId: "bill_1", kind: "setup", amount: 50000, status: "paid", issuedAt: iso(y, mo - 6, 1) },
      { id: "inv_2", billingCustomerId: "bill_1", kind: "monthly", amount: 15000, status: "paid", issuedAt: iso(y, mo - 2, 1) },
      { id: "inv_3", billingCustomerId: "bill_1", kind: "monthly", amount: 15000, status: "paid", issuedAt: iso(y, mo - 1, 1) },
      { id: "inv_4", billingCustomerId: "bill_1", kind: "monthly", amount: 15000, status: "paid", issuedAt: iso(y, mo, 1) },
    ],
    systemSettings: [
      { id: "set_1", key: "distribution_strategy", value: "weighted" },
      { id: "set_2", key: "plan", value: "standard" },
    ],
    storedImages: [],
    // コントロールプレーン（運営DBのみ使用。クライアントのデモseedでは空）
    clientAccounts: [],
    clientInstances: [],
    instanceMetrics: [],
    affiliates: [],
    affiliateReferrals: [],
    affiliateCommissions: [],
  };
}

function mkAccount(
  id: string,
  name: string,
  status: LineAccount["status"],
  capacity: number,
  weight: number
): LineAccount {
  return {
    id,
    name,
    status,
    channelId: `200000${id.slice(-1)}`,
    channelSecret: "demo_secret",
    channelAccessToken: "demo_token",
    addFriendUrl: `https://lin.ee/${id}`,
    capacity,
    registeredCount: 0,
    weight,
    backupUrl: status !== "active" ? `https://lin.ee/${id}-backup` : undefined,
    migrationMessage:
      status !== "active" ? "新しいアカウントへの移行をお願いします。" : undefined,
    createdAt: new Date(2025, 10, 1).toISOString(),
  };
}

function mkTag(id: string, name: string, color: string): Tag {
  return { id, name, color, createdAt: new Date(2025, 11, 1).toISOString() };
}

const SURNAMES = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤"];
const GIVEN = ["太郎", "花子", "健", "美咲", "翔", "結衣", "大輔", "さくら", "拓海", "葵"];
function randomName(rng: () => number): string {
  return `${SURNAMES[Math.floor(rng() * SURNAMES.length)]}${GIVEN[Math.floor(rng() * GIVEN.length)]}`;
}
