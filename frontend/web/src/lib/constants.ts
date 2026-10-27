import {
  LayoutDashboard,
  CheckSquare,
  FileCheck,
  FolderKanban,
  Users,
  Building2,
  FileText,
  ShieldCheck,
  FolderOpen,
  Bot,
  ClipboardList,
  CreditCard,
  Settings,
  MessageSquare,
  Bell,
  Network,
  Trash2,
  BarChart3,
  Clock,
  Wallet,
  Receipt,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[]; // if undefined, visible to all
  children?: { label: string; href: string }[]; // renders as an expandable dropdown instead of a direct link
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const sidebarNavigation: NavGroup[] = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Submissions", href: "/submissions", icon: FileCheck, roles: ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"] },
      { label: "Projects", href: "/projects", icon: FolderKanban, roles: ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"] },
      { label: "PMCS", href: "/pmcs", icon: BarChart3, roles: ["EXECUTIVE", "BOARD_MEMBER", "ADMIN"] },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { label: "Team", href: "/team", icon: Users, roles: ["ADMIN", "MANAGER", "DEPT_HEAD"] },
      { label: "Departments", href: "/departments", icon: Building2, roles: ["ADMIN", "MANAGER", "DEPT_HEAD"] },
      { label: "Job Descriptions", href: "/job-descriptions", icon: FileText, roles: ["ADMIN", "MANAGER", "DEPT_HEAD"] },
      { label: "Organogram", href: "/organogram", icon: Network, roles: ["ADMIN", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER"] },
    ],
  },
  {
    title: "PAYROLL",
    items: [
      {
        label: "Timesheets",
        href: "/timesheets",
        icon: Clock,
        children: [
          { label: "My Timesheets", href: "/timesheets" },
          { label: "Team Approvals", href: "/timesheets/approvals" },
        ],
      },
      { label: "Payslips", href: "/payslips", icon: Receipt },
      { label: "Payroll Configuration", href: "/payroll-configuration", icon: Wallet, roles: ["EXECUTIVE", "BOARD_MEMBER", "ADMIN"] },
      { label: "Institutions", href: "/institutions", icon: Landmark, roles: ["EXECUTIVE", "BOARD_MEMBER", "ADMIN"] },
    ],
  },
  {
    title: "DOCUMENTS",
    items: [
      { label: "Policy Vault", href: "/policies", icon: ShieldCheck },
      { label: "Project Docs", href: "/project-documents", icon: FolderOpen, roles: ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "ADMIN"] },
      { label: "Project Reports", href: "/project-reports", icon: FileText, roles: ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "ADMIN"] },
    ],
  },
  {
    title: "AI",
    items: [
      { label: "AI Assistant", href: "/ai-assistant", icon: Bot },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Audit Trail", href: "/audit-trail", icon: ClipboardList, roles: ["ADMIN", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER"] },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Billing", href: "/billing", icon: CreditCard, roles: ["ADMIN"] },
      { label: "Messages", href: "/messages", icon: MessageSquare },
      { label: "Deletion Requests", href: "/deletion-requests", icon: Trash2, roles: ["BOARD_MEMBER", "ADMIN"] },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];