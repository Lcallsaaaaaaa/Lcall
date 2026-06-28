import { requireNav } from "@/lib/guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireNav("lp");
  return <>{children}</>;
}
