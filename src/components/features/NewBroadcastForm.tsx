"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { createBroadcast } from "@/features/broadcasts/actions";
import type { BroadcastType, LineAccount, Tag } from "@/lib/data/types";

const TYPES: { value: BroadcastType; title: string; desc: string }[] = [
  { value: "text", title: "テキスト", desc: "本文のみのメッセージ" },
  { value: "url", title: "URL付き", desc: "本文＋計測URL（クリック計測・自動タグ）" },
  // カルーセルは「カルーセル」画面から作成（ここでは扱わない）
];

export function NewBroadcastForm({
  tags,
  accounts,
  adCodes,
}: {
  tags: Tag[];
  accounts: LineAccount[];
  adCodes: { code: string; label: string }[];
}) {
  const [type, setType] = useState<BroadcastType>("text");

  return (
    <form action={createBroadcast} className="space-y-5">
      <input type="hidden" name="type" value={type} />

      <Card>
        <CardHeader title="配信タイプ" />
        <div className="grid grid-cols-1 gap-2.5 p-5 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-lg border p-3 text-left transition ${
                type === t.value
                  ? "border-brand bg-surface-2"
                  : "border-line hover:bg-surface-2"
              }`}
            >
              <span className="block text-sm font-medium text-ink">{t.title}</span>
              <span className="mt-0.5 block text-xs text-muted">{t.desc}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="内容" />
        <div className="space-y-4 p-5">
          <FormField label="配信タイトル" htmlFor="title" required hint="管理用の名前（受信者には表示されません）">
            <Input id="title" name="title" placeholder="6月キャンペーン告知" required />
          </FormField>

          <FormField label="本文" htmlFor="text" required={type === "text"}>
            <Textarea id="text" name="text" placeholder="メッセージ本文を入力" />
          </FormField>

          {type === "url" && (
            <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
              <FormField label="遷移先URL" htmlFor="targetUrl" required className="sm:col-span-2" hint="計測URLを自動生成します">
                <Input id="targetUrl" name="targetUrl" placeholder="https://example.com/lp" />
              </FormField>
              <FormField label="クリック時に付与するタグ" htmlFor="autoTagId">
                <Select id="autoTagId" name="autoTagId" defaultValue="">
                  <option value="">なし</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="広告コード（流入元・任意）" htmlFor="adCode">
                <Select id="adCode" name="adCode" defaultValue="">
                  <option value="">なし</option>
                  {adCodes.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
                <input type="checkbox" name="openExternalBrowser" defaultChecked className="accent-[#dd2a7b]" />
                外部ブラウザで開く（openExternalBrowser=1）
              </label>
            </div>
          )}

        </div>
      </Card>

      <Card>
        <CardHeader title="配信対象" description="未選択なら全員。タグを選ぶとタグ条件付き配信になります。" />
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">対象タグ</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <label
                  key={t.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-surface-2"
                >
                  <input type="checkbox" name="targetTagIds" value={t.id} className="accent-[#dd2a7b]" />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
          <FormField label="送信元LINEアカウント" htmlFor="lineAccountId" hint="未指定なら全アカウント対象">
            <Select id="lineAccountId" name="lineAccountId" defaultValue="">
              <option value="">指定しない</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/broadcasts" className={buttonClasses("ghost", "md")}>
          キャンセル
        </Link>
        <button type="submit" className={buttonClasses("gradient", "md")}>
          作成する
        </button>
      </div>
    </form>
  );
}
