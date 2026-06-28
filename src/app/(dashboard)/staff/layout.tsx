import { requireNav } from "@/lib/guard";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireNav("staff"); // オーナーのみ
  return <>{children}</>;
}
