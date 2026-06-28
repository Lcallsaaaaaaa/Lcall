import { LayoutDashboard, Share2, Users, type LucideIcon } from "lucide-react";

export interface OperatorNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** 運営コンソール（コントロールプレーン）のナビ。 */
export const OPERATOR_NAV: OperatorNavItem[] = [
  { label: "ダッシュボード", href: "/operator", icon: LayoutDashboard },
  { label: "クライアント", href: "/operator/clients", icon: Users },
  { label: "アフィリエイト", href: "/operator/affiliates", icon: Share2 },
];
