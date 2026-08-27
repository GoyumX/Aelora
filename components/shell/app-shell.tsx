import type { ReactNode } from "react";

import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import type { UserRole } from "@/lib/auth/authorization";

type AppShellProps = {
  alertCount?: number;
  children: ReactNode;
  siteName?: string;
  user?: { name: string; email: string };
  role?: UserRole;
};

export function AppShell({ alertCount = 0, children, siteName, user, role = "USER" }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background">
      <a
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        href="#main-content"
      >
        Skip to main content
      </a>
      <div className="fixed inset-y-0 left-0 z-40 hidden w-68 lg:block">
        <AppSidebar alertCount={alertCount} role={role} />
      </div>
      <div className="min-h-dvh lg:pl-68">
        <AppHeader alertCount={alertCount} role={role} siteName={siteName} user={user} />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
