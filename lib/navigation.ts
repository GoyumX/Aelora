import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BatteryCharging,
  Bell,
  ChartNoAxesCombined,
  CircleHelp,
  FileText,
  Gauge,
  PlugZap,
  LayoutDashboard,
  PanelsTopLeft,
  Settings,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { UserRole } from "@/lib/auth/authorization";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavigationItem[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const appNavigation: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        label: "Live Monitoring",
        href: "/live-monitoring",
        icon: Activity,
      },
      { label: "AI Forecast", href: "/ai-forecast", icon: Sparkles },
      { label: "Performance", href: "/performance", icon: Gauge },
      {
        label: "Historical Analytics",
        href: "/historical-analytics",
        icon: ChartNoAxesCombined,
      },
      { label: "Alerts", href: "/alerts", icon: Bell },
      { label: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "System Configuration",
        href: "/system-configuration",
        icon: Settings2,
        children: [
          {
            label: "Solar Panels",
            href: "/system-configuration/solar-panels",
            icon: PanelsTopLeft,
          },
          {
            label: "Inverter",
            href: "/system-configuration/inverter",
            icon: PlugZap,
          },
          {
            label: "Battery",
            href: "/system-configuration/battery",
            icon: BatteryCharging,
          },
        ],
      },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Help & Support", href: "/help", icon: CircleHelp },
    ],
  },
];

const adminNavigation: NavigationGroup = {
  label: "Administration",
  items: [
    { label: "Admin Console", href: "/admin", icon: ShieldCheck },
  ],
};

export function getNavigationForRole(role: UserRole): NavigationGroup[] {
  return role === "ADMIN" ? [...appNavigation, adminNavigation] : appNavigation;
}

export function getNavigationItems(
  groups: NavigationGroup[],
): NavigationItem[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => [item, ...(item.children ?? [])]),
  );
}

export function findNavigationItem(
  pathname: string,
  groups: NavigationGroup[],
): NavigationItem | undefined {
  return getNavigationItems(groups)
    .filter(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((left, right) => right.href.length - left.href.length)[0];
}
