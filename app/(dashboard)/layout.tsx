import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const alertCount = site ? await db.alertIncident.count({
    where: { siteId: site.id, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
  }) : 0;

  return (
    <AppShell alertCount={alertCount} role={user.role} siteName={site?.name} user={user}>
      {children}
    </AppShell>
  );
}
