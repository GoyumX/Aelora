import { ArrowRight, RadioTower } from "lucide-react";
import Link from "next/link";

import { LiveMonitoring } from "@/components/monitoring/live-monitoring";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createTelemetrySnapshot } from "@/lib/telemetry/simulator";

export default async function LiveMonitoringPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, timezone: true, mode: true, status: true, arrays: { where: { archivedAt: null, status: "ACTIVE" }, select: { panelCount: true, ratedPowerW: true } } },
  });

  if (!site) {
    return (
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><RadioTower aria-hidden="true" className="size-7" /></span>
        <h1 className="mt-6 font-heading text-3xl font-semibold">No solar site to monitor</h1>
        <p className="mt-3 leading-7 text-muted-foreground">Configure a site first, then Aelora can publish a clearly labelled canonical simulation stream.</p>
        <Button className="mt-7" render={<Link href="/system-configuration" />}>Open configuration <ArrowRight aria-hidden="true" /></Button>
      </section>
    );
  }

  const installedCapacityW = site.arrays.reduce((sum, array) => sum + array.panelCount * array.ratedPowerW, 0);
  return <LiveMonitoring initialTelemetry={createTelemetrySnapshot({ ...site, installedCapacityW: installedCapacityW || undefined })} />;
}
