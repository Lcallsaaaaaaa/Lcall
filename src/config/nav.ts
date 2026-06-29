import {
  BarChart3,
  Bot,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  GalleryHorizontalEnd,
  Images,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Send,
  Settings,
  Share2,
  Smartphone,
  Tag,
  UserCog,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** false の機能は「準備中」表示（後続フェーズで実装） */
  ready: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** サイドバー構成。MVP優先度（§11）に沿って全15機能を提示し、実装済みのみ有効化。 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "概要",
    items: [
      { key: "dashboard", label: "ダッシュボード", href: "/", icon: LayoutDashboard, ready: true },
      { key: "analytics", label: "分析", href: "/analytics", icon: BarChart3, ready: true },
    ],
  },
  {
    label: "集客",
    items: [
      { key: "line", label: "LINEアカウント", href: "/line-accounts", icon: Smartphone, ready: true },
      { key: "rich-menus", label: "リッチメニュー", href: "/rich-menus", icon: LayoutGrid, ready: true },
      { key: "distribution", label: "分散登録URL", href: "/distribution", icon: Share2, ready: true },
      { key: "ad-codes", label: "広告コード", href: "/ad-codes", icon: Megaphone, ready: true },
    ],
  },
  {
    label: "顧客",
    items: [
      { key: "friends", label: "顧客管理", href: "/friends", icon: Users, ready: true },
      { key: "chat", label: "チャット対応", href: "/inbox", icon: MessagesSquare, ready: true },
      { key: "ai-characters", label: "AIキャラ", href: "/ai-characters", icon: Bot, ready: true },
      { key: "templates", label: "定型文", href: "/message-templates", icon: MessageSquareText, ready: true },
      { key: "tags", label: "タグ管理", href: "/tags", icon: Tag, ready: true },
    ],
  },
  {
    label: "配信",
    items: [
      { key: "broadcasts", label: "配信管理", href: "/broadcasts", icon: Send, ready: true },
      { key: "scenarios", label: "シナリオ配信", href: "/scenarios", icon: Workflow, ready: true },
      { key: "carousel", label: "カルーセル", href: "/carousel", icon: GalleryHorizontalEnd, ready: true },
    ],
  },
  {
    label: "獲得",
    items: [
      { key: "forms", label: "申込フォーム", href: "/forms", icon: FileText, ready: true },
      { key: "surveys", label: "アンケート", href: "/surveys", icon: ClipboardList, ready: true },
      { key: "reservations", label: "予約表", href: "/reservations", icon: CalendarClock, ready: true },
      { key: "lp", label: "LP管理", href: "/landing-pages", icon: LayoutTemplate, ready: true },
      { key: "media", label: "メディア", href: "/media", icon: Images, ready: true },
    ],
  },
  {
    label: "設定",
    items: [
      { key: "billing", label: "契約・請求", href: "/billing", icon: CreditCard, ready: true },
      { key: "staff", label: "スタッフ管理", href: "/staff", icon: UserCog, ready: true },
      { key: "settings", label: "設定", href: "/settings", icon: Settings, ready: false },
    ],
  },
];
