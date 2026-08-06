"use client";

import {
  Activity,
  BatteryCharging,
  CircuitBoard,
  CloudSun,
  Gauge,
  House,
  RefreshCw,
  SunMedium,
  Thermometer,
  UtilityPole,
  Zap,
} from "lucide-react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TelemetryApiResponse, TelemetrySnapshot } from "@/lib/telemetry/types";
import { cn } from "@/lib/utils";

export async function fetchTelemetry(url: string): Promise<TelemetryApiResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Telemetry refresh failed");
  return response.json();
}

function kw(value: number) {
  return `${(Math.abs(value) / 1000).toFixed(2)} kW`;
}

function gridLabel(value: number) {
  if (value < 0) return `Exporting ${kw(value)}`;
  if (value > 0) return `Importing ${kw(value)}`;
  return "Grid neutral";
}

function batteryLabel(value: number) {
  if (value < 0) return `Charging ${kw(value)}`;
  if (value > 0) return `Discharging ${kw(value)}`;
  return "Battery idle";
}

function chartPoints(values: number[], max: number) {
  return values.map((value, index) => `${24 + (index / Math.max(1, values.length - 1)) * 552},${188 - (value / max) * 145}`).join(" ");
}

function statusTone(status: string) {
  if (status === "NORMAL") return "border-energy/25 bg-energy/10 text-energy-strong";
  if (status === "OFFLINE" || status.includes("FAULT") || status === "GRID_OUTAGE") return "border-alert-critical/25 bg-alert-critical/10 text-alert-critical";
  return "border-alert-warning/30 bg-alert-warning/10 text-solar-strong";
}

export function LiveMonitoring({ initialTelemetry }: { initialTelemetry: TelemetrySnapshot }) {
  const endpoint = `/api/sites/${initialTelemetry.siteId}/telemetry/latest`;
  const { data, error, isValidating, mutate } = useSWR<TelemetryApiResponse>(endpoint, fetchTelemetry, {
    fallbackData: { data: initialTelemetry, meta: { refreshAfterSeconds: 15 } },
    refreshInterval: 15_000,
    revalidateOnFocus: true,
    revalidateOnMount: false,
  });
  const telemetry = data?.data ?? initialTelemetry;
  const maxChartValue = Math.max(6000, ...telemetry.series.flatMap((point) => [point.pvPowerW, point.loadPowerW]));
  const metrics = [
    { label: "Solar output", value: kw(telemetry.pvPowerW), detail: `${(telemetry.pvEnergyTodayWh / 1000).toFixed(1)} kWh today`, icon: SunMedium, tone: "bg-solar/15 text-solar-strong" },
    { label: "Home demand", value: kw(telemetry.loadPowerW), detail: "Current household load", icon: House, tone: "bg-primary/10 text-primary" },
    { label: "Battery state", value: `${telemetry.batterySocPct}%`, detail: batteryLabel(telemetry.batteryPowerW), icon: BatteryCharging, tone: "bg-energy/12 text-energy-strong" },
    { label: "Grid", value: gridLabel(telemetry.gridPowerW), detail: "Positive import · negative export", icon: UtilityPole, tone: "bg-forecast/12 text-forecast-strong" },
  ];
  const electrical = [
    ["DC voltage", `${telemetry.dcVoltageV.toFixed(0)} V`],
    ["DC current", `${telemetry.dcCurrentA.toFixed(1)} A`],
    ["AC voltage", `${telemetry.acVoltageV.toFixed(1)} V`],
    ["AC current", `${telemetry.acCurrentA.toFixed(1)} A`],
    ["Grid voltage", `${telemetry.gridVoltageV.toFixed(1)} V`],
    ["Frequency", `${telemetry.frequencyHz.toFixed(2)} Hz`],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end" aria-labelledby="live-title">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Detailed telemetry</p>
            <Badge className="border-primary/20 bg-primary/8 text-primary" variant="outline">Simulated data</Badge>
            <Badge className={statusTone(telemetry.deviceStatus)} variant="outline">{telemetry.deviceStatus === "NORMAL" ? "● Live & healthy" : telemetry.deviceStatus.replaceAll("_", " ")}</Badge>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl" id="live-title">Live Monitoring</h1>
          <p className="mt-2 text-muted-foreground">{telemetry.siteName} · canonical telemetry updates every {data?.meta.refreshAfterSeconds ?? 15} seconds</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div aria-live="polite" className="text-sm text-muted-foreground">
            <span className="block">Last received</span>
            <time dateTime={telemetry.observedAt}>{new Intl.DateTimeFormat("en-LK", { timeStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(telemetry.observedAt))}</time>
          </div>
          <Button aria-label="Refresh telemetry" disabled={isValidating} onClick={() => void mutate()} size="lg" variant="outline">
            <RefreshCw aria-hidden="true" className={cn(isValidating && "animate-spin")} /> Refresh
          </Button>
        </div>
      </section>

      <section aria-label="Simulation scenario" className={cn("rounded-xl border px-4 py-3", statusTone(telemetry.deviceStatus))}>
        <div className="flex items-start gap-3"><Activity aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">{telemetry.scenario.label}</p><p className="mt-0.5 text-sm opacity-80">{telemetry.scenario.message}</p></div></div>
      </section>

      {error ? <p className="rounded-xl border border-alert-warning/30 bg-alert-warning/10 p-4 text-sm" role="alert">The latest refresh failed. Showing the most recent available snapshot.</p> : null}

      <section aria-label="Live power metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => <Card className="shadow-xs" key={label}><CardHeader><span className={cn("grid size-10 place-items-center rounded-xl", tone)}><Icon aria-hidden="true" className="size-5" /></span><CardDescription className="mt-2">{label}</CardDescription><CardTitle className="text-xl font-semibold">{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{detail}</CardContent></Card>)}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,.65fr)]">
        <Card className="shadow-xs">
          <CardHeader><CardTitle><h2>Last-hour power trend</h2></CardTitle><CardDescription>Five-minute simulated samples for solar output and household demand.</CardDescription></CardHeader>
          <CardContent>
            <svg aria-label="Last-hour solar and household power" className="h-auto w-full" role="img" viewBox="0 0 600 225">
              <title>Last-hour solar and household power</title><desc>Amber line shows solar power; blue dashed line shows household demand.</desc>
              {[43, 91, 139, 187].map((y) => <line className="stroke-border" key={y} x1="24" x2="576" y1={y} y2={y} />)}
              <polyline className="fill-none stroke-solar [stroke-width:4]" points={chartPoints(telemetry.series.map((point) => point.pvPowerW), maxChartValue)} strokeLinecap="round" strokeLinejoin="round" />
              <polyline className="fill-none stroke-primary [stroke-width:3]" points={chartPoints(telemetry.series.map((point) => point.loadPowerW), maxChartValue)} strokeDasharray="7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-solar" />Solar power</span><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />Household demand</span></div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader><CardTitle><h2>Environmental conditions</h2></CardTitle><CardDescription>Inputs and thermal conditions affecting output.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {[{ label: "Solar irradiance", value: `${telemetry.irradianceWm2} W/m²`, icon: CloudSun }, { label: "Panel temperature", value: `${telemetry.panelTemperatureC.toFixed(1)}°C`, icon: Thermometer }, { label: "Inverter temperature", value: `${telemetry.inverterTemperatureC.toFixed(1)}°C`, icon: CircuitBoard }].map(({ label, value, icon: Icon }) => <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/65 p-4" key={label}><span className="flex items-center gap-3 text-sm text-muted-foreground"><Icon aria-hidden="true" className="size-4.5 text-primary" />{label}</span><strong className="font-mono">{value}</strong></div>)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-xs">
          <CardHeader><CardTitle><h2>Electrical measurements</h2></CardTitle><CardDescription>Inverter and grid values from the canonical monitoring contract.</CardDescription></CardHeader>
          <CardContent><dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{electrical.map(([label, value]) => <div className="rounded-xl border p-4" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-lg font-semibold">{value}</dd></div>)}</dl></CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader><CardTitle><h2>Array contribution</h2></CardTitle><CardDescription>Contribution and explicit state for each simulated panel array.</CardDescription></CardHeader>
          <CardContent className="space-y-3">{telemetry.arrays.map((array) => <div className="rounded-xl border p-4" key={array.id}><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">{array.name}</p><p className="mt-1 font-mono text-lg">{kw(array.powerW)}</p></div><Badge className={statusTone(array.status)} variant="outline">{array.status.toLowerCase().replaceAll("_", " ")}</Badge></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", array.status === "NORMAL" ? "bg-energy" : "bg-alert-warning")} style={{ width: `${telemetry.pvPowerW ? Math.max(5, (array.powerW / telemetry.pvPowerW) * 100) : 0}%` }} /></div></div>)}</CardContent>
        </Card>
      </div>

      <Card className="shadow-xs">
        <CardHeader><CardTitle><h2>Data quality & conventions</h2></CardTitle><CardDescription>Information needed to interpret these readings correctly.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/65 p-4"><Gauge aria-hidden="true" className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Quality</p><p className="mt-1 font-semibold">{telemetry.quality.toLowerCase()}</p></div>
          <div className="rounded-xl bg-muted/65 p-4"><Zap aria-hidden="true" className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Grid convention</p><p className="mt-1 font-semibold">Positive import · negative export</p></div>
          <div className="rounded-xl bg-muted/65 p-4"><BatteryCharging aria-hidden="true" className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Battery convention</p><p className="mt-1 font-semibold">Positive discharge · negative charge</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
