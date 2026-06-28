/* eslint-disable @next/next/no-img-element */
import { ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Form";
import { addMedia, deleteMedia } from "@/features/media/actions";
import { listMedia } from "@/features/media/queries";

const UPLOAD_ERROR: Record<string, string> = {
  nofile: "ファイルを選択してください。",
  type: "画像ファイルを選択してください。",
  size: "5MBを超える画像はアップロードできません。",
};

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, media] = await Promise.all([searchParams, listMedia()]);

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">メディア（画像）</h1>
        <p className="mt-1 text-sm text-muted">
          画像を保管し、シナリオ・カルーセル・LP などで「保管から選択」して使います。
        </p>
      </div>

      {error && UPLOAD_ERROR[error] && (
        <div className="mb-4 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {UPLOAD_ERROR[error]}
        </div>
      )}

      <Card className="mb-5">
        <CardHeader title="画像をアップロード" description="PC内の画像ファイルをアップロードして保管します（最大5MB）" />
        <form
          action="/api/media/upload"
          method="post"
          encType="multipart/form-data"
          className="flex flex-wrap items-end gap-3 p-5"
        >
          <FormField label="名前（任意）" htmlFor="upname" className="min-w-40 flex-1">
            <Input id="upname" name="name" placeholder="キャンペーンバナー" />
          </FormField>
          <FormField label="画像ファイル" htmlFor="file" required className="min-w-56 flex-[2]">
            <input
              id="file"
              name="file"
              type="file"
              accept="image/*"
              required
              className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-ink hover:file:bg-line"
            />
          </FormField>
          <Button type="submit" variant="gradient" size="md">
            <Upload className="size-4" />
            アップロード
          </Button>
        </form>
      </Card>

      <Card className="mb-5">
        <CardHeader title="URLで登録" description="外部の画像URLを保管に追加" />
        <form action={addMedia} className="flex flex-wrap items-end gap-3 p-5">
          <FormField label="名前" htmlFor="name" className="min-w-40 flex-1">
            <Input id="name" name="name" placeholder="キャンペーンバナー" />
          </FormField>
          <FormField label="画像URL" htmlFor="url" required className="min-w-56 flex-[2]">
            <Input id="url" name="url" placeholder="https://..." required />
          </FormField>
          <Button type="submit" variant="outline" size="md">
            <Plus className="size-4" />
            登録
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="保管中の画像" description={`${media.length}件`} />
        {media.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted">
            <ImageIcon className="size-4" /> 画像がまだありません。
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-lg border border-line">
                <div className="flex h-28 items-center justify-center bg-surface-2">
                  <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate text-sm text-ink" title={m.name}>
                    {m.name}
                  </span>
                  <form action={deleteMedia.bind(null, m.id)}>
                    <button type="submit" className="rounded p-1 text-muted transition hover:bg-danger-bg hover:text-danger" title="削除">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
