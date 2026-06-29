import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import { RICH_MENU_CANVAS, getTemplate, templateCellsPercent } from "@/config/rich-menu-templates";
import {
  applyRichMenu,
  deleteRichMenu,
  unapplyRichMenu,
  updateRichMenuAreas,
  updateRichMenuBasics,
  uploadRichMenuImageAction,
} from "@/features/rich-menus/actions";
import { getRichMenu } from "@/features/rich-menus/queries";
import { RichMenuImageInput } from "@/components/features/RichMenuImageInput";
import { getDataProvider } from "@/lib/data/provider";

const OK_MSG: Record<string, string> = {
  created: "作成しました。画像とボタンを設定してください。",
  saved: "基本情報を保存しました。",
  areas: "ボタン設定を保存しました。",
  image: "メニュー画像をアップロードしました。",
  applied: "LINEへ反映しました。",
  unapplied: "LINEの反映を解除しました。",
};
const ERR_MSG: Record<string, string> = {
  nofile: "ファイルを選択してください。",
  type: "画像ファイルを選択してください。",
  imagesize: "画像は1MB以下にしてください（LINEの制約）。",
  demo: "このアカウントは実トークン未設定のため反映できません。LINEアカウント編集でChannel Access Tokenを設定してください。",
  noimage: "先にメニュー画像をアップロードしてください。",
  noarea: "アクション付きのボタンを1つ以上設定してください。",
  imageread: "保存画像の読み込みに失敗しました。再アップロードしてください。",
  create: "LINEでのメニュー作成に失敗しました（画像サイズ・トークン権限をご確認ください）。",
  upload: "LINEへの画像アップロードに失敗しました（JPEG/PNG・1MB以下・推奨サイズをご確認ください）。",
  template: "テンプレートが不正です。",
};

export default async function EditRichMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const menu = await getRichMenu(id);
  if (!menu) redirect("/rich-menus");

  const [accounts, tags] = await Promise.all([
    getDataProvider().lineAccounts.list(),
    getDataProvider().tags.list(),
  ]);
  const account = accounts.find((a) => a.id === menu.lineAccountId);
  const t = getTemplate(menu.template);
  const cellsPct = t ? templateCellsPercent(t) : [];
  const canvas = RICH_MENU_CANVAS[menu.size];
  const ratio = `${canvas.width} / ${canvas.height}`;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link href="/rich-menus" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" />
        リッチメニュー一覧へ
      </Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">{menu.name}</h1>
      <p className="mb-5 text-sm text-muted">
        {account?.name ?? "（不明なアカウント）"}・{t?.label ?? menu.template}
        {menu.lineRichMenuId ? "・" : ""}
        {menu.lineRichMenuId && <span className="font-medium text-ok">反映済み</span>}
      </p>

      {ok && OK_MSG[ok] && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#bbf7d0] bg-ok-bg px-4 py-2.5 text-sm text-ok">
          <CheckCircle2 className="size-4 shrink-0" />
          {OK_MSG[ok]}
        </div>
      )}
      {error && ERR_MSG[error] && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#fecaca] bg-danger-bg px-4 py-2.5 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" />
          {ERR_MSG[error]}
        </div>
      )}

      <div className="space-y-5">
        {/* 基本情報 */}
        <form action={updateRichMenuBasics.bind(null, id)}>
          <Card>
            <CardHeader title="基本情報" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <FormField label="管理名称" htmlFor="name" required>
                <Input id="name" name="name" defaultValue={menu.name} required />
              </FormField>
              <FormField label="メニューバーの文言" htmlFor="chatBarText" hint="14文字まで">
                <Input id="chatBarText" name="chatBarText" defaultValue={menu.chatBarText} maxLength={14} />
              </FormField>
              <FormField label="表示対象" htmlFor="scope">
                <Select id="scope" name="scope" defaultValue={menu.isDefault ? "default" : "tag"}>
                  <option value="default">既定メニュー（全友だちに表示）</option>
                  <option value="tag">タグ別の出し分け</option>
                </Select>
              </FormField>
              <FormField label="対象タグ" htmlFor="targetTagId" hint="「タグ別」の場合に指定">
                <Select id="targetTagId" name="targetTagId" defaultValue={menu.targetTagId ?? ""}>
                  <option value="">（タグを選択）</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="flex justify-end border-t border-line px-5 py-3">
              <button type="submit" className={buttonClasses("outline", "sm")}>基本情報を保存</button>
            </div>
          </Card>
        </form>

        {/* メニュー画像 + プレビュー */}
        <Card>
          <CardHeader
            title="メニュー画像"
            description={`推奨サイズ ${canvas.width}×${canvas.height}px ／ JPEG・PNG ／ 1MB以下。画像の各エリアにボタンが重なります。`}
          />
          <div className="space-y-4 p-5">
            <div
              className="relative w-full overflow-hidden rounded-lg border border-line-strong bg-surface-2"
              style={{ aspectRatio: ratio }}
            >
              {menu.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={menu.imageUrl} alt="メニュー画像" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-faint">
                  画像をアップロードしてください
                </div>
              )}
              {cellsPct.map((c, i) => {
                const area = menu.areas[i];
                const filled = area && area.action !== "none" && (area.uri || area.text);
                return (
                  <div
                    key={i}
                    className="absolute flex items-center justify-center border border-white/70 bg-black/10 text-center"
                    style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.width}%`, height: `${c.height}%` }}
                  >
                    <span className="rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {i + 1}. {area?.label || (filled ? "設定済み" : "未設定")}
                    </span>
                  </div>
                );
              })}
            </div>

            <form action={uploadRichMenuImageAction.bind(null, id)} className="flex flex-wrap items-end gap-3">
              <FormField label="画像ファイル" htmlFor="image" className="flex-1" hint="大きい画像は自動で1MB以下に最適化されます">
                <RichMenuImageInput />
              </FormField>
              <button type="submit" className={buttonClasses("outline", "md")}>アップロード</button>
            </form>
          </div>
        </Card>

        {/* ボタン（タップ領域）設定 */}
        <form action={updateRichMenuAreas.bind(null, id)}>
          <Card>
            <CardHeader title="ボタン（タップ領域）" description="番号は上のプレビューの位置に対応します。アクション種別を選んで内容を入力してください。" />
            <div className="divide-y divide-line">
              {menu.areas.map((area, i) => (
                <div key={i} className="space-y-3 p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-brand">
                      {i + 1}
                    </span>
                    ボタン{i + 1}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="アクション" htmlFor={`action_${i}`}>
                      <Select id={`action_${i}`} name={`action_${i}`} defaultValue={area.action}>
                        <option value="none">なし（タップ無効）</option>
                        <option value="uri">URLを開く</option>
                        <option value="message">メッセージを送信</option>
                      </Select>
                    </FormField>
                    <FormField label="ラベル" htmlFor={`label_${i}`} hint="ボタンの名称（管理・読み上げ用）">
                      <Input id={`label_${i}`} name={`label_${i}`} defaultValue={area.label} maxLength={20} placeholder="予約する" />
                    </FormField>
                    <FormField label="リンク先URL" htmlFor={`uri_${i}`} hint="「URLを開く」の場合。https:// / tel: など" className="sm:col-span-2">
                      <Input id={`uri_${i}`} name={`uri_${i}`} defaultValue={area.uri} placeholder="https://example.com/reserve" />
                    </FormField>
                    <FormField label="送信メッセージ" htmlFor={`text_${i}`} hint="「メッセージを送信」の場合。タップでこの文がユーザーから送られます" className="sm:col-span-2">
                      <Textarea id={`text_${i}`} name={`text_${i}`} defaultValue={area.text} placeholder="クーポンをください" rows={2} />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-line px-5 py-3">
              <button type="submit" className={buttonClasses("outline", "sm")}>ボタン設定を保存</button>
            </div>
          </Card>
        </form>

        {/* LINEへ反映 */}
        <Card>
          <CardHeader
            title="LINEへ反映"
            description="保存した内容を実際のLINE公式アカウントに反映します。反映済みのまま内容を変更した場合は再度反映してください。"
          />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">状態:</span>
              {menu.lineRichMenuId ? (
                <span className="rounded-full bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok">
                  反映済み{menu.appliedAt ? `（${new Date(menu.appliedAt).toLocaleString("ja-JP")}）` : ""}
                </span>
              ) : (
                <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">下書き（未反映）</span>
              )}
            </div>
            {!account || account.channelAccessToken === "demo_token" || account.channelAccessToken.length <= 20 ? (
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
                このLINEアカウントはデモ/未設定トークンのため、実反映はスキップされます。LINEアカウント編集で実トークンを設定すると反映できます。
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <form action={applyRichMenu.bind(null, id)}>
                <button type="submit" className={buttonClasses("gradient", "md")}>
                  {menu.lineRichMenuId ? "再反映する" : "LINEに反映する"}
                </button>
              </form>
              {menu.lineRichMenuId && (
                <form action={unapplyRichMenu.bind(null, id)}>
                  <button type="submit" className={buttonClasses("ghost", "md")}>反映を解除</button>
                </form>
              )}
              <form action={deleteRichMenu.bind(null, id)} className="ml-auto">
                <button type="submit" className="rounded-lg px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger-bg">
                  削除
                </button>
              </form>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
