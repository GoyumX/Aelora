"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AeloraMark } from "@/components/brand/aelora-mark";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/auth/authorization";
import { getNavigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  alertCount?: number;
  className?: string;
  onNavigate?: () => void;
  role?: UserRole;
};

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ alertCount = 0, className, onNavigate, role = "USER" }: AppSidebarProps) {
  const pathname = usePathname();
  const navigation = getNavigationForRole(role);

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2"
          href="/dashboard"
          onClick={onNavigate}
        >
          <AeloraMark />
          <span className="sr-only">Go to dashboard</span>
        </Link>
      </div>

      <nav
        aria-label="Primary navigation"
        className="flex-1 space-y-6 overflow-y-auto px-3 py-5"
      >
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/55">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isCurrentRoute(pathname, item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      aria-label={item.label === "Alerts" && alertCount > 0 ? `Alerts, ${alertCount} open` : undefined}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        active &&
                          "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                      )}
                      href={item.href}
                      onClick={onNavigate}
                    >
                      <Icon aria-hidden="true" className="size-4.5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.label === "Alerts" && alertCount > 0 && (
                        <Badge
                          className="min-w-5 justify-center bg-alert-critical text-white"
                          variant="secondary"
                        >
                          {alertCount > 99 ? "99+" : alertCount}
                        </Badge>
                      )}
                    </Link>

                    {item.children && active && (
                      <ul className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = pathname === child.href;

                          return (
                            <li key={child.href}>
                              <Link
                                aria-current={childActive ? "page" : undefined}
                                className={cn(
                                  "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/70 outline-none transition-colors",
                                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                  childActive &&
                                    "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                                )}
                                href={child.href}
                                onClick={onNavigate}
                              >
                                <ChildIcon
                                  aria-hidden="true"
                                  className="size-4 shrink-0"
                                />
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-xl bg-sidebar-accent/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-energy opacity-40 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-energy" />
            </span>
            Gateway pipeline ready
          </div>
          <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">
            Live data arrives through an enrolled site gateway.
          </p>
        </div>
      </div>
    </aside>
  );
}
