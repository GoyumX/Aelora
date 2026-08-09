import { PanelsTopLeft } from "lucide-react";

import { SolarArrayForm } from "@/components/configuration/solar-array-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function SolarPanelsPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, arrays: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } } } });
  if (!site) return <main className="mx-auto max-w-3xl p-8"><h1 className="font-heading text-3xl font-semibold">No site available</h1></main>;
  const capacityW = site.arrays.reduce((sum, array) => sum + array.panelCount * array.ratedPowerW, 0);
  return <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-7 sm:px-6 sm:py-9 lg:px-8"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{site.name}</p><h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">Solar panel configuration</h1><p className="mt-3 text-muted-foreground">{site.arrays.length} arrays · {capacityW / 1000} kWp installed capacity</p></header><section className="grid gap-4 md:grid-cols-2">{site.arrays.map((array) => <Card key={array.id}><CardHeader><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-xl bg-solar/15 text-solar-strong"><PanelsTopLeft aria-hidden="true" className="size-5" /></span><Badge variant="outline">{array.status.toLowerCase()}</Badge></div><CardTitle className="mt-3">{array.name}</CardTitle><CardDescription>{array.manufacturer || "Unspecified manufacturer"} {array.model || ""}</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Panels</p><p className="mt-1 font-medium">{array.panelCount} × {array.ratedPowerW} W</p></div><div><p className="text-muted-foreground">Capacity</p><p className="mt-1 font-medium">{(array.panelCount * array.ratedPowerW / 1000).toFixed(2)} kWp</p></div><div><p className="text-muted-foreground">Tilt</p><p className="mt-1 font-medium">{array.tiltDeg} degrees</p></div><div><p className="text-muted-foreground">Azimuth</p><p className="mt-1 font-medium">{array.azimuthDeg} degrees</p></div></CardContent></Card>)}</section><Card><CardHeader><CardTitle>Add solar array</CardTitle><CardDescription>Add another roof face or group of panels. Array names must be unique within the site.</CardDescription></CardHeader><CardContent><SolarArrayForm siteId={site.id} /></CardContent></Card></main>;
}
