import { ArrowRight, BatteryCharging, Cable, Cpu, PanelsTopLeft, RadioTower, Settings2 } from "lucide-react";
import Link from "next/link";

import { GatewayCredentialActions } from "@/components/configuration/gateway-credential-actions";
import { SiteConfigurationForm } from "@/components/configuration/site-configuration-form";
import { GatewaySetup } from "@/components/configuration/gateway-setup";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deriveConnectivityStatus } from "@/lib/gateway/status";

const links = [
  { href: "/system-configuration/solar-panels", title: "Solar arrays", description: "Panel count, rated power, orientation, and installation details.", icon: PanelsTopLeft },
  { href: "/system-configuration/inverter", title: "Inverter", description: "AC rating, efficiency, adapter type, and polling interval.", icon: Cpu },
  { href: "/system-configuration/battery", title: "Battery", description: "Optional storage capacity, power limits, and reserve policy.", icon: BatteryCharging },
];

export default async function SystemConfigurationPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({
    where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, latitude: true, longitude: true, timezone: true, mode: true,
      arrays: { where: { archivedAt: null }, select: { panelCount: true, ratedPowerW: true } },
      _count: { select: { inverters: true } }, battery: { select: { enabled: true } },
      gateways: {
        where: { revokedAt: null }, orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, mode: true, status: true, enrolledAt: true, lastSeenAt: true,
          lastHeartbeatAt: true, lastTelemetryAt: true, expectedIntervalSec: true,
          softwareVersion: true, credentialVersion: true, _count: { select: { devices: true } },
        },
      },
    },
  });
  if (!site) return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="font-heading text-3xl font-semibold">No solar site configured</h1><p className="mt-3 text-muted-foreground">A site-creation workflow will be added for new accounts. The development seed includes a ready-to-use site.</p></main>;
  const capacityKw = site.arrays.reduce((sum, array) => sum + array.panelCount * array.ratedPowerW, 0) / 1000;

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header><div className="flex flex-wrap items-center gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">System setup</p><Badge variant="outline">{site.gateways.length ? `${site.gateways.length} gateway${site.gateways.length === 1 ? "" : "s"}` : "No gateway enrolled"}</Badge></div><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">System configuration</h1><p className="mt-3 max-w-2xl text-muted-foreground">Define site equipment and enroll the local gateway that securely sends telemetry to Aelora.</p></header>
      <section aria-label="Equipment configuration" className="grid gap-4 lg:grid-cols-3">
        {links.map(({ href, title, description, icon: Icon }) => <Link className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} key={href}><Card className="h-full transition-colors group-hover:bg-muted/30"><CardHeader><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span><ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><CardTitle className="mt-3">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader></Card></Link>)}
      </section>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Configuration summary"><Card><CardHeader><CardDescription>Installed solar</CardDescription><CardTitle className="text-2xl">{capacityKw.toFixed(2)} kWp</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Inverter records</CardDescription><CardTitle className="text-2xl">{site._count.inverters}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Battery</CardDescription><CardTitle className="text-2xl">{site.battery?.enabled ? "Enabled" : "Not enabled"}</CardTitle></CardHeader></Card></section>
      <Card><CardHeader><div className="flex items-center gap-3"><RadioTower aria-hidden="true" className="size-5 text-primary" /><CardTitle>Site gateways</CardTitle></div><CardDescription>The virtual gateway runs as its own Python application. Later, the same secure ingest contract can be used by an on-site hardware gateway.</CardDescription></CardHeader><CardContent className="space-y-5">
        {site.gateways.length ? <div className="grid gap-3 md:grid-cols-2">{site.gateways.map((gateway) => {
          const status = gateway.enrolledAt ? deriveConnectivityStatus(gateway.lastSeenAt, gateway.expectedIntervalSec) : "NEVER_SEEN";
          return <div className="rounded-xl border p-4" key={gateway.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{gateway.name}</p><p className="mt-1 text-xs text-muted-foreground">{gateway.mode.toLowerCase()} · {gateway._count.devices} devices · {gateway.expectedIntervalSec}s interval · credential v{gateway.credentialVersion}</p></div><Badge className={status === "ONLINE" ? "border-energy/25 bg-energy/10 text-energy-strong" : "border-alert-warning/30 bg-alert-warning/10 text-solar-strong"} variant="outline">{gateway.enrolledAt ? status.toLowerCase().replaceAll("_", " ") : "pending enrollment"}</Badge></div><div className="mt-3 grid gap-1 text-xs text-muted-foreground"><p>{gateway.lastHeartbeatAt ? `Last heartbeat ${gateway.lastHeartbeatAt.toLocaleString()}` : "No heartbeat received yet"}</p><p>{gateway.lastTelemetryAt ? `Last telemetry ${gateway.lastTelemetryAt.toLocaleString()}` : "No telemetry received yet"}{gateway.softwareVersion ? ` · ${gateway.softwareVersion}` : ""}</p></div>{gateway.enrolledAt ? <GatewayCredentialActions gateway={{ id: gateway.id, name: gateway.name }} siteId={site.id} /> : null}</div>;
        })}</div> : <div className="flex items-start gap-3 rounded-xl border border-dashed p-4"><Cable aria-hidden="true" className="mt-0.5 size-5 text-muted-foreground" /><p className="text-sm leading-6 text-muted-foreground">Create an enrollment below, then paste its one-time token into the separately running Python virtual gateway.</p></div>}
        <GatewaySetup siteId={site.id} />
      </CardContent></Card>
      <Card><CardHeader><div className="flex items-center gap-3"><Settings2 aria-hidden="true" className="size-5 text-primary" /><CardTitle>Site details</CardTitle></div><CardDescription>Location and timezone anchor the simulator and future weather forecast.</CardDescription></CardHeader><CardContent><SiteConfigurationForm site={site} /></CardContent></Card>
    </main>
  );
}
