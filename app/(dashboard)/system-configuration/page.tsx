import { ArrowRight, BatteryCharging, Cpu, PanelsTopLeft, Settings2 } from "lucide-react";
import Link from "next/link";

import { SiteConfigurationForm } from "@/components/configuration/site-configuration-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const links = [
  { href: "/system-configuration/solar-panels", title: "Solar arrays", description: "Panel count, rated power, orientation, and installation details.", icon: PanelsTopLeft },
  { href: "/system-configuration/inverter", title: "Inverter", description: "AC rating, efficiency, adapter type, and polling interval.", icon: Cpu },
  { href: "/system-configuration/battery", title: "Battery", description: "Optional storage capacity, power limits, and reserve policy.", icon: BatteryCharging },
];

export default async function SystemConfigurationPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({
    where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" },
    select: { id: true, name: true, latitude: true, longitude: true, timezone: true, mode: true, arrays: { where: { archivedAt: null }, select: { panelCount: true, ratedPowerW: true } }, _count: { select: { inverters: true } }, battery: { select: { enabled: true } } },
  });
  if (!site) return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="font-heading text-3xl font-semibold">No solar site configured</h1><p className="mt-3 text-muted-foreground">A site-creation workflow will be added for new accounts. The development seed includes a ready-to-use site.</p></main>;
  const capacityKw = site.arrays.reduce((sum, array) => sum + array.panelCount * array.ratedPowerW, 0) / 1000;

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header><div className="flex flex-wrap items-center gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">System setup</p><Badge variant="outline">{site.mode === "SIMULATED" ? "Simulator connected" : "Hardware mode"}</Badge></div><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">System configuration</h1><p className="mt-3 max-w-2xl text-muted-foreground">Define the physical system that powers monitoring and the digital-twin calculations.</p></header>
      <section aria-label="Equipment configuration" className="grid gap-4 lg:grid-cols-3">
        {links.map(({ href, title, description, icon: Icon }) => <Link className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} key={href}><Card className="h-full transition-colors group-hover:bg-muted/30"><CardHeader><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span><ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><CardTitle className="mt-3">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader></Card></Link>)}
      </section>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Configuration summary"><Card><CardHeader><CardDescription>Installed solar</CardDescription><CardTitle className="text-2xl">{capacityKw.toFixed(2)} kWp</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Inverter records</CardDescription><CardTitle className="text-2xl">{site._count.inverters}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Battery</CardDescription><CardTitle className="text-2xl">{site.battery?.enabled ? "Enabled" : "Not enabled"}</CardTitle></CardHeader></Card></section>
      <Card><CardHeader><div className="flex items-center gap-3"><Settings2 aria-hidden="true" className="size-5 text-primary" /><CardTitle>Site details</CardTitle></div><CardDescription>Location and timezone anchor the simulator and future weather forecast.</CardDescription></CardHeader><CardContent><SiteConfigurationForm site={site} /></CardContent></Card>
    </main>
  );
}
