/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VarTextarea } from "@/components/features/VarTextarea";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import {
  addScenarioStep,
  deleteScenario,
  deleteScenarioStep,
  moveScenarioStep,
  runScenario,
  updateScenario,
  updateScenarioStep,
} from "@/features/scenarios/actions";
import type { ScenarioStepView } from "@/features/scenarios/queries";
import { getScenario } from "@/features/scenarios/queries";
import { listBroadcasts } from "@/features/broadcasts/queries";
import { listMedia } from "@/features/media/queries";
import { listTags } from "@/features/tags/queries";

interface TagLite {
  id: string;
  name: string;
}
interface MediaLite {
  id: string;
  name: string;
  url: string;
}
interface CarouselLite {
  id: string;
  title: string;
  cardCount: number;
}

interface StepDefaults {
  delayValue: number;
  delayUnit: string;
  sendAt: string;
  stepType: string;
  carouselBroadcastId: string;
  text: string;
  imageUrl: string;
  autoTagId: string;
  conditionMode: string;
  conditionTagId: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function splitDelay(min: number): { value: number; unit: string } {
  if (min <= 0) return { value: 0, unit: "day" };
  if (min % 1440 === 0) return { value: min / 1440, unit: "day" };
  if (min % 60 === 0) return { value: min / 60, unit: "hour" };
  return { value: min, unit: "minute" };
}

function stepDefaults(s: ScenarioStepView): StepDefaults {
  const d = splitDelay(s.delayMinutes);
  return {
    delayValue: d.value,
    delayUnit: d.unit,
    sendAt: s.sendAtHour != null && s.sendAtMinute != null ? `${pad(s.sendAtHour)}:${pad(s.sendAtMinute)}` : "",
    stepType: s.carouselBroadcastId ? "carousel" : "text",
    carouselBroadcastId: s.carouselBroadcastId ?? "",
    text: s.text === "（本文未設定）" ? "" : s.text,
    imageUrl: s.imageUrl ?? "",
    autoTagId: s.autoTagId ?? "",
    conditionMode: s.conditionMode ?? "always",
    conditionTagId: s.conditionTagId ?? "",
  };
}

const ADD_DEFAULTS: StepDefaults = {
  delayValue: 0,
  delayUnit: "day",
  sendAt: "",
  stepType: "text",
  carouselBroadcastId: "",
  text: "",
  imageUrl: "",
  autoTagId: "",
  conditionMode: "always",
  conditionTagId: "",
};

/** ステップ追加・編集で共通のフィールド一式。 */
function StepFields({
  d,
  tags,
  media,
  carousels,
}: {
  d: StepDefaults;
  tags: TagLite[];
  media: MediaLite[];
  carousels: CarouselLite[];
}) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="配信タイミング" htmlFor="delayValue" hint="0 = 追加時挨拶">
          <div className="flex items-center gap-2">
            <Input name="delayValue" type="number" min={0} defaultValue={d.delayValue} className="w-24" />
            <Select name="delayUnit" defaultValue={d.delayUnit} className="w-24">
              <option value="minute">分後</option>
              <option value="hour">時間後</option>
              <option value="day">日後</option>
            </Select>
          </div>
        </FormField>
        <FormField label="配信時刻（任意）" htmlFor="sendAt" hint="指定日のこの時刻に配信">
          <Input name="sendAt" type="time" defaultValue={d.sendAt} className="w-32" />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="種類" htmlFor="stepType">
          <Select name="stepType" defaultValue={d.stepType}>
            <option value="text">テキスト</option>
            <option value="carousel">カルーセル</option>
          </Select>
        </FormField>
        <FormField
          label="カルーセル配信（種類=カルーセル時）"
          htmlFor="carouselBroadcastId"
          hint={carousels.length ? "送信するカルーセル配信を選択" : "カード付きカルーセル配信が必要です"}
        >
          <Select name="carouselBroadcastId" defaultValue={d.carouselBroadcastId}>
            <option value="">選択…</option>
            {carousels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}（{c.cardCount}枚）
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">本文</label>
        <VarTextarea name="text" defaultValue={d.text} placeholder="メッセージ本文（カルーセル時は任意の代替テキスト）" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="画像（保管から選択）" htmlFor="imageUrl" hint="メディアに登録した画像から選べます">
          <Select name="imageUrl" defaultValue={d.imageUrl}>
            <option value="">なし</option>
            {media.map((m) => (
              <option key={m.id} value={m.url}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="配信時に付与するタグ" htmlFor="autoTagId">
          <Select name="autoTagId" defaultValue={d.autoTagId}>
            <option value="">なし</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
        <FormField label="配信条件（タグ分岐）" htmlFor="conditionMode">
          <Select name="conditionMode" defaultValue={d.conditionMode}>
            <option value="always">全員に配信</option>
            <option value="hasTag">指定タグを持つ人だけ</option>
            <option value="notHasTag">指定タグを持たない人だけ</option>
          </Select>
        </FormField>
        <FormField label="条件タグ" htmlFor="conditionTagId" hint="「持つ/持たない」で使用">
          <Select name="conditionTagId" defaultValue={d.conditionTagId}>
            <option value="">（タグを選択）</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </>
  );
}

export default async function ScenarioEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, tags, media, broadcasts] = await Promise.all([
    getScenario(id),
    listTags(),
    listMedia(),
    listBroadcasts(),
  ]);
  if (!detail) notFound();
  const carousels = broadcasts.filter((b) => b.type === "carousel" && b.cardCount > 0);
  const { scenario, steps, eligibleCount, totalSent } = detail;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link href="/scenarios" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        シナリオ一覧へ
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{scenario.name}</h1>
        {scenario.status === "active" ? <Badge tone="ok">稼働中</Badge> : <Badge tone="neutral">停止中</Badge>}
      </div>

      {/* 実行 */}
      <Card accentRail className="mb-5">
        <CardHeader title="配信の実行" description="到達済みのステップを処理します。本番は数分間隔のcronで自動実行（/api/scenarios/run）。" />
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="text-sm text-muted">
            対象 約<span className="font-semibold text-ink">{eligibleCount.toLocaleString()}</span>人 ・ 配信実績{" "}
            <span className="font-semibold text-ink">{totalSent.toLocaleString()}</span>件
          </div>
          <form action={runScenario.bind(null, id)} className="ml-auto">
            <Button type="submit" variant="gradient" size="md">
              <Play className="size-4" />
              今すぐ配信を実行
            </Button>
          </form>
        </div>
      </Card>

      {/* 設定 */}
      <Card className="mb-5">
        <CardHeader title="設定" />
        <form action={updateScenario.bind(null, id)} className="space-y-4 p-5">
          <FormField label="シナリオ名" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={scenario.name} required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="状態" htmlFor="status">
              <Select id="status" name="status" defaultValue={scenario.status}>
                <option value="active">稼働中</option>
                <option value="paused">停止中</option>
              </Select>
            </FormField>
            <FormField label="対象タグ（タグ分け）" htmlFor="targetTagId" hint="未指定なら全友だち">
              <Select id="targetTagId" name="targetTagId" defaultValue={scenario.targetTagId ?? ""}>
                <option value="">全員</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="solid" size="md">
              保存
            </Button>
          </div>
        </form>
      </Card>

      {/* ステップ */}
      <Card className="mb-5">
        <CardHeader title="ステップ" description={`${steps.length}ステップ — 上から順に経過時間で配信。各ステップは「編集」で修正できます`} />
        <div className="divide-y divide-line">
          {steps.map((s, i) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <Badge tone={s.delayMinutes === 0 ? "info" : "neutral"}>{s.delayLabel}</Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm text-ink">{s.text}</p>
                  {s.imageUrl && (
                    <img src={s.imageUrl} alt="" className="mt-2 h-16 rounded border border-line object-cover" />
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {s.carouselTitle && <Badge tone="info">カルーセル: {s.carouselTitle}</Badge>}
                    {s.conditionLabel && <Badge tone="warn">条件: {s.conditionLabel}</Badge>}
                    {s.autoTagName && <Badge tone="info">{s.autoTagName}を付与</Badge>}
                    <span>送信 {s.sentCount.toLocaleString()}件</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <form action={moveScenarioStep.bind(null, s.id, id, "up")}>
                    <button type="submit" disabled={i === 0} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                      <ChevronUp className="size-4" />
                    </button>
                  </form>
                  <form action={moveScenarioStep.bind(null, s.id, id, "down")}>
                    <button type="submit" disabled={i === steps.length - 1} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                      <ChevronDown className="size-4" />
                    </button>
                  </form>
                  <form action={deleteScenarioStep.bind(null, s.id, id)}>
                    <button type="submit" className="rounded p-1 text-muted hover:bg-danger-bg hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              </div>

              <details className="mt-2">
                <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand hover:underline">
                  <Pencil className="size-3.5" />
                  このステップを編集
                </summary>
                <form action={updateScenarioStep.bind(null, s.id, id)} className="mt-3 space-y-4 rounded-lg border border-line p-4">
                  <StepFields d={stepDefaults(s)} tags={tags} media={media} carousels={carousels} />
                  <div className="flex justify-end">
                    <Button type="submit" variant="solid" size="sm">
                      変更を保存
                    </Button>
                  </div>
                </form>
              </details>
            </div>
          ))}
          {steps.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">ステップがありません。下から追加してください。</p>}
        </div>

        <form action={addScenarioStep.bind(null, id)} className="space-y-4 border-t border-line p-5">
          <p className="text-sm font-medium text-ink">ステップを追加</p>
          <StepFields d={ADD_DEFAULTS} tags={tags} media={media} carousels={carousels} />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" size="md">
              <Plus className="size-4" />
              ステップを追加
            </Button>
          </div>
        </form>
      </Card>

      {/* 削除 */}
      <Card>
        <CardHeader title="削除" description="このシナリオとステップ・配信実績を削除します。" />
        <div className="p-5">
          <form action={deleteScenario.bind(null, id)}>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg">
              <Trash2 className="size-4" />
              このシナリオを削除
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
