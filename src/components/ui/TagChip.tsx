/** タグ色を反映したチップ。color は #rrggbb 想定（背景は10%アルファ）。 */
export function TagChip({ name, color }: { name: string; color?: string }) {
  const c = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6b7280";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${c}1a`, color: c }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
      {name}
    </span>
  );
}
