import { ArrowRight, PanelsTopLeft } from "lucide-react";
import Link from "next/link";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { createDashboardSnapshot } from "@/lib/dashboard/snapshot";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, mode: true, status: true, timezone: true, arrays: { where: { archivedAt: null, status: "ACTIVE" }, select: { panelCount: true, ratedPowerW: true } } },
  });

  if (!site) {
    return (
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><PanelsTopLeft aria-hidden="true" className="size-7" /></span>
        <h1 className="mt-6 font-heading text-3xl font-semibold">Configure your first solar site</h1>
        <p className="mt-3 leading-7 text-muted-foreground">The dashboard needs a site before it can create a clearly labelled simulated energy snapshot.</p>
        <Button className="mt-7" render={<Link href="/system-configuration" />}>Open configuration <ArrowRight aria-hidden="true" /></Button>
      </section>
    );
  }

  const installedCapacityW = site.arrays.reduce((sum, array) => sum + array.panelCount * array.ratedPowerW, 0);
  return <DashboardOverview snapshot={createDashboardSnapshot({ ...site, installedCapacityW: installedCapacityW || undefined })} />;
}
