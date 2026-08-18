import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BrainCircuit,
  CloudSun,
  Gauge,
  House,
  Lightbulb,
  SunMedium,
  UtilityPole,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { cn } from "@/lib/utils";

function powerFlowLabel(value: number) {
  if (value < 0) return `Exporting ${Math.abs(value).toFixed(2)} kW`;
  if (value > 0) return `Importing ${value.toFixed(2)} kW`;
  return "Grid neutral";
}

function linePoints(values: number[], max: number) {
  return values
    .map((value, index) => `${24 + (index / Math.max(1, values.length - 1)) * 552},${190 - (value / max) * 150}`)
    .join(" ");
}

export function DashboardOverview({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { metrics } = snapshot;
  const maxChartValue = Math.max(6, ...snapshot.intraday.flatMap((point) => [point.generationKw, point.consumptionKw]));
  const metricCards = [
    { label: "Current solar", value: `${metrics.pvPowerKw.toFixed(2)} kW`, detail: "AC output now", icon: SunMedium, color: "text-solar-strong bg-solar/15" },
    { label: "Energy today", value: `${metrics.energyTodayKwh.toFixed(1)} kWh`, detail: "Since sunrise", icon: Activity, color: "text-primary bg-primary/10" },
    { label: "Home consumption", value: `${metrics.loadPowerKw.toFixed(2)} kW`, detail: "Current demand", icon: House, color: "text-forecast-strong bg-forecast/12" },
    { label: "Battery", value: `${metrics.batterySocPct}%`, detail: metrics.batteryPowerKw < 0 ? `Charging ${Math.abs(metrics.batteryPowerKw).toFixed(2)} kW` : `Discharging ${metrics.batteryPowerKw.toFixed(2)} kW`, icon: BatteryCharging, color: "text-energy-strong bg-energy/12" },
    { label: "Grid flow", value: powerFlowLabel(metrics.gridPowerKw), detail: "Negative means export", icon: UtilityPole, color: "text-primary bg-primary/10" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" aria-labelledby="dashboard-title">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operational overview</p>
            <Badge className="border-primary/20 bg-primary/8 text-primary" variant="outline">{snapshot.site.mode === "SIMULATED" ? "Virtual gateway" : "Hardware gateway"}</Badge>
            <Badge className={snapshot.connectivityStatus === "ONLINE" ? "border-energy/25 bg-energy/10 text-energy-strong" : "border-alert-warning/30 bg-alert-warning/10 text-solar-strong"} variant="outline">{snapshot.connectivityStatus === "ONLINE" ? "● Connected" : snapshot.connectivityStatus.toLowerCase().replaceAll("_", " ")}</Badge>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl" id="dashboard-title">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">{snapshot.site.name} · {snapshot.sourceLabel}</p>
        </div>
        <div className="text-sm text-muted-foreground sm:text-right">
          <p>Snapshot updated</p>
          <time dateTime={snapshot.observedAt}>{new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(snapshot.observedAt))}</time>
        </div>
      </section>

      <section aria-label="Current energy metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map(({ label, value, detail, icon: Icon, color }) => (
          <Card className="min-w-0 shadow-xs" key={label}>
            <CardHeader className="gap-3">
              <div className={cn("grid size-10 place-items-center rounded-xl", color)}><Icon aria-hidden="true" className="size-5" /></div>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-xl font-semibold tracking-tight break-words">{value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,.75fr)]">
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle><h2>Today&apos;s energy profile</h2></CardTitle>
            <CardDescription>Stored gateway samples for solar generation and household consumption.</CardDescription>
          </CardHeader>
          <CardContent>
            <svg aria-label="Intraday solar generation and household consumption" className="h-auto w-full" role="img" viewBox="0 0 600 230">
              <title>Intraday solar generation and household consumption</title>
              <desc>Amber shows simulated solar power. Blue shows household demand from 06:00 to 18:00.</desc>
              {[40, 90, 140, 190].map((y) => <line className="stroke-border" key={y} x1="24" x2="576" y1={y} y2={y} />)}
              <polyline className="fill-none stroke-solar [stroke-width:4]" points={linePoints(snapshot.intraday.map((point) => point.generationKw), maxChartValue)} strokeLinecap="round" strokeLinejoin="round" />
              <polyline className="fill-none stroke-primary [stroke-width:3]" points={linePoints(snapshot.intraday.map((point) => point.consumptionKw), maxChartValue)} strokeDasharray="7 7" strokeLinecap="round" strokeLinejoin="round" />
              <text className="fill-muted-foreground text-[11px]" x="24" y="218">06:00</text>
              <text className="fill-muted-foreground text-[11px]" textAnchor="middle" x="300" y="218">12:00</text>
              <text className="fill-muted-foreground text-[11px]" textAnchor="end" x="576" y="218">18:00</text>
            </svg>
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-solar" />Solar generation</span><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />Home consumption</span></div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader><CardTitle><h2>Weather & solar conditions</h2></CardTitle><CardDescription>Conditions reported by the site gateway.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-solar/15 text-solar-strong"><CloudSun aria-hidden="true" className="size-7" /></span><div><p className="text-lg font-semibold">{metrics.weather.condition}</p><p className="text-sm text-muted-foreground">{metrics.weather.temperatureC}°C panel temperature</p></div></div>
            <dl className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/70 p-4"><dt className="text-xs text-muted-foreground">Irradiance</dt><dd className="mt-1 font-mono text-lg font-semibold">{metrics.weather.irradianceWm2} W/m²</dd></div><div className="rounded-xl bg-muted/70 p-4"><dt className="text-xs text-muted-foreground">Site state</dt><dd className="mt-1 text-lg font-semibold capitalize">{snapshot.site.status.toLowerCase()}</dd></div></dl>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/live-monitoring">Open live monitoring <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <Card className="shadow-xs">
          <CardHeader><CardTitle><h2>Energy flow now</h2></CardTitle><CardDescription>Positive grid values mean import; negative values mean export.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[{ icon: SunMedium, label: "Solar", value: `${metrics.pvPowerKw.toFixed(2)} kW`, tone: "bg-solar/15 text-solar-strong" }, { icon: House, label: "Home", value: `${metrics.loadPowerKw.toFixed(2)} kW`, tone: "bg-primary/10 text-primary" }, { icon: BatteryCharging, label: "Battery", value: `${metrics.batterySocPct}%`, tone: "bg-energy/12 text-energy-strong" }, { icon: UtilityPole, label: "Grid", value: powerFlowLabel(metrics.gridPowerKw), tone: "bg-forecast/12 text-forecast-strong" }].map(({ icon: Icon, label, value, tone }) => <div className="rounded-xl border p-4" key={label}><span className={cn("grid size-9 place-items-center rounded-lg", tone)}><Icon aria-hidden="true" className="size-4.5" /></span><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader><CardTitle><h2>48-hour AI forecast</h2></CardTitle><CardDescription>Early planning summary; open the forecast page for hourly detail.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {snapshot.forecast.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">Forecast output is intentionally withheld until the trained model service is connected. Live gateway data is already being collected for that pipeline.</p> : null}
            {snapshot.forecast.map((day) => <div className="flex items-center justify-between gap-4 rounded-xl border p-4" key={day.label}><div><p className="font-semibold">{day.label}</p><p className="text-sm text-muted-foreground">{day.condition} · {day.confidencePct}% confidence</p></div><div className="text-right"><p className="font-mono text-lg font-semibold">{day.predictedEnergyKwh.toFixed(1)} kWh</p><p className="text-xs text-muted-foreground">predicted</p></div></div>)}
            <Link className="inline-flex items-center gap-2 pt-2 text-sm font-semibold text-primary hover:underline" href="/ai-forecast">View full AI forecast <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </CardContent>
        </Card>
      </div>

      <section aria-label="Operational guidance" className="grid gap-4 lg:grid-cols-2">
        <Card className="border-energy/25 bg-energy/5 shadow-xs"><CardHeader><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-energy/12 text-energy-strong"><Gauge aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>{snapshot.alert.title}</h2></CardTitle><CardDescription className="mt-1 leading-6">{snapshot.alert.detail}</CardDescription></div></div></CardHeader></Card>
        <Card className="border-primary/20 bg-primary/5 shadow-xs"><CardHeader><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Lightbulb aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>Recommended next action</h2></CardTitle><CardDescription className="mt-1 leading-6">{snapshot.recommendation}</CardDescription></div></div></CardHeader></Card>
      </section>

      <section aria-label="Dashboard shortcuts" className="grid gap-3 sm:grid-cols-3">
        {[{ href: "/live-monitoring", label: "Open live monitoring", icon: Zap }, { href: "/ai-forecast", label: "View full AI forecast", icon: BrainCircuit }, { href: "/system-configuration", label: "Review configuration", icon: Gauge }].map(({ href, label, icon: Icon }) => <Link className="flex min-h-14 items-center justify-between rounded-xl border bg-card px-4 font-semibold shadow-xs transition-colors hover:bg-accent" href={href} key={href}><span className="flex items-center gap-3"><Icon aria-hidden="true" className="size-4.5 text-primary" />{label}</span><ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" /></Link>)}
      </section>
    </div>
  );
}
