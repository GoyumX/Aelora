import { ArrowRight, RadioTower } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LiveMonitoring } from "@/components/monitoring/live-monitoring";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getLatestTelemetrySnapshot } from "@/lib/telemetry/latest-service";

export const metadata: Metadata = { title: "Live monitoring" };

export default async function LiveMonitoringPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (!site) {
    return (
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><RadioTower aria-hidden="true" className="size-7" /></span>
        <h1 className="mt-6 font-heading text-3xl font-semibold">No solar site to monitor</h1>
        <p className="mt-3 leading-7 text-muted-foreground">Configure a site first, then enroll a virtual or hardware gateway to publish telemetry.</p>
        <Button className="mt-7" render={<Link href="/system-configuration" />}>Open configuration <ArrowRight aria-hidden="true" /></Button>
      </section>
    );
  }

  const telemetry = await getLatestTelemetrySnapshot(site);
  if (!telemetry) {
    return (
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><RadioTower aria-hidden="true" className="size-7" /></span>
        <h1 className="mt-6 font-heading text-3xl font-semibold">Waiting for the first gateway reading</h1>
        <p className="mt-3 leading-7 text-muted-foreground">Enroll and run the separate virtual gateway. This page will begin updating after Aelora accepts its first batch.</p>
        <Button className="mt-7" render={<Link href="/system-configuration" />}>Set up a gateway <ArrowRight aria-hidden="true" /></Button>
      </section>
    );
  }
  return <LiveMonitoring initialTelemetry={telemetry} />;
}
