import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/Form";
import type { AiCharacter, LineAccount } from "@/lib/data/types";

const STATUS_OPTIONS = [
  { value: "active", label: "稼働中" },
  { value: "warning", label: "警告" },
  { value: "paused", label: "停止中" },
  { value: "suspended", label: "凍結" },
];

interface Props {
  action: (formData: FormData) => void | Promise<void>;
  account?: LineAccount;
  submitLabel: string;
  characters: AiCharacter[];
}

/** LINEアカウントの新規/編集フォーム（§5）。server action を action に受け取る。 */
export function LineAccountForm({ action, account, submitLabel, characters }: Props) {
  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardHeader title="基本情報" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <FormField label="アカウント名" htmlFor="name" required>
            <Input id="name" name="name" defaultValue={account?.name} placeholder="メイン窓口A" required />
          </FormField>
          <FormField label="ステータス" htmlFor="status">
            <Select id="status" name="status" defaultValue={account?.status ?? "active"}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader title="LINE連携" description="LINE Developers の Messaging API 設定値" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <FormField label="Channel ID" htmlFor="channelId">
            <Input id="channelId" name="channelId" defaultValue={account?.channelId} />
          </FormField>
          <FormField label="Channel Secret" htmlFor="channelSecret">
            <Input id="channelSecret" name="channelSecret" defaultValue={account?.channelSecret} />
          </FormField>
          <FormField label="Channel Access Token" htmlFor="channelAccessToken" className="sm:col-span-2">
            <Input
              id="channelAccessToken"
              name="channelAccessToken"
              defaultValue={account?.channelAccessToken}
            />
          </FormField>
          <FormField label="友だち追加URL" htmlFor="addFriendUrl" className="sm:col-span-2" hint="例: https://lin.ee/xxxxxxx">
            <Input id="addFriendUrl" name="addFriendUrl" defaultValue={account?.addFriendUrl} />
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader title="振り分け設定" description="分散登録URLでの割り当てに使用" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <FormField label="登録上限数" htmlFor="capacity" hint="この数に達すると振り分け対象から除外">
            <Input id="capacity" name="capacity" type="number" min={0} defaultValue={account?.capacity ?? 5000} />
          </FormField>
          <FormField label="振り分け比率（重み）" htmlFor="weight" hint="weighted 方式で使用。大きいほど多く割り当て">
            <Input id="weight" name="weight" type="number" min={0} defaultValue={account?.weight ?? 1} />
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader title="予備LINE・緊急導線" description="停止・凍結時の避難導線（§8）" />
        <div className="grid grid-cols-1 gap-4 p-5">
          <FormField label="予備LINE URL" htmlFor="backupUrl">
            <Input id="backupUrl" name="backupUrl" defaultValue={account?.backupUrl} />
          </FormField>
          <FormField label="移行案内メッセージ" htmlFor="migrationMessage">
            <Textarea
              id="migrationMessage"
              name="migrationMessage"
              defaultValue={account?.migrationMessage}
              placeholder="新しいアカウントへの移行をお願いします。"
            />
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="AI自動応答"
          description="受信メッセージにClaudeで自動返信。応答のキャラ（口調・知識）は「AIキャラ」で作成し、ここで割り当てます。"
        />
        <div className="space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="aiEnabled"
              defaultChecked={account?.aiEnabled ?? false}
              className="accent-[#dd2a7b]"
            />
            AI自動応答を有効にする
          </label>
          <FormField
            label="既定のAIキャラクター"
            htmlFor="aiCharacterId"
            hint="このアカウントの既定キャラ。タグ／友だち単位で上書きできます。未設定は汎用アシスタント。"
          >
            <Select id="aiCharacterId" name="aiCharacterId" defaultValue={account?.aiCharacterId ?? ""}>
              <option value="">（未設定＝汎用アシスタント）</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Anthropic APIキー（任意）"
            htmlFor="aiApiKey"
            hint="未入力なら共通の環境変数キーを使用。アカウント別に課金を分けたい場合のみ入力。"
          >
            <Input
              id="aiApiKey"
              name="aiApiKey"
              type="password"
              defaultValue={account?.aiApiKey}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </FormField>
          <p className="text-xs text-faint">
            「オペレーター」「担当者」等のメッセージでAIは自動停止し有人対応へ切替（受信箱で再開可）。AI応答1件ごとに従量課金されます。
          </p>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/line-accounts" className={buttonClasses("ghost", "md")}>
          キャンセル
        </Link>
        <button type="submit" className={buttonClasses("gradient", "md")}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
