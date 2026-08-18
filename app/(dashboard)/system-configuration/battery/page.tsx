import { BatteryCharging } from "lucide-react";

import { BatteryForm } from "@/components/configuration/battery-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function BatteryPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, battery: true } });
  if (!site) return <main className="mx-auto max-w-3xl p-8"><h1 className="font-heading text-3xl font-semibold">No site available</h1></main>;
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-7 sm:px-6 sm:py-9"><header><span className="grid size-11 place-items-center rounded-xl bg-energy/15 text-energy-strong"><BatteryCharging aria-hidden="true" /></span><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{site.name}</p><h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">Battery settings</h1><p className="mt-3 text-muted-foreground">Battery storage is optional. Disable it when the site is solar-and-grid only.</p></header><Card><CardHeader><CardTitle>Storage profile</CardTitle><CardDescription>Capacity and reserve settings will feed energy-flow simulation and recommendations.</CardDescription></CardHeader><CardContent><BatteryForm battery={site.battery} siteId={site.id} /></CardContent></Card></main>;
}
