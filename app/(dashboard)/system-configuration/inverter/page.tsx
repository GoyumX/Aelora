import { Cpu } from "lucide-react";
import type { Metadata } from "next";

import { InverterForm } from "@/components/configuration/inverter-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Inverter settings" };

export default async function InverterPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, inverters: { where: { archivedAt: null }, orderBy: { createdAt: "asc" }, take: 1 } } });
  if (!site) return <main className="mx-auto max-w-3xl p-8"><h1 className="font-heading text-3xl font-semibold">No site available</h1></main>;
  const inverter = site.inverters[0];
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-7 sm:px-6 sm:py-9"><header><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Cpu aria-hidden="true" /></span><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{site.name}</p><h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">Inverter settings</h1><p className="mt-3 text-muted-foreground">Configure the primary inverter and the adapter the monitoring layer will use.</p></header><Card><CardHeader><CardTitle>{inverter ? `${inverter.manufacturer} ${inverter.model}` : "Primary inverter"}</CardTitle><CardDescription>Credentials are deliberately not collected on this screen.</CardDescription></CardHeader><CardContent><InverterForm inverter={inverter} siteId={site.id} /></CardContent></Card></main>;
}
