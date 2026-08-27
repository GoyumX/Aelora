import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BrainCircuit,
  CloudSun,
  CloudRain,
  Droplets,
  Gauge,
  House,
  Lightbulb,
  MapPin,
  SunMedium,
  UtilityPole,
  Wind,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { InteractivePowerChart } from "@/components/charts/interactive-power-chart";
import { DynamicDataControls } from "@/components/shared/dynamic-data-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { cn } from "@/lib/utils";

function powerFlowLabel(value: number) {
  if (value < 0) return `Exporting ${Math.abs(value).toFixed(2)} kW`;
  if (value > 0) return `Importing ${value.toFixed(2)} kW`;
  return "Grid neutral";
}

function weatherIcon(condition: string, className: string) {
  return condition.toLowerCase().includes("rain")
    ? <CloudRain aria-hidden="true" className={className} />
    : condition.toLowerCase().includes("cloud")
      ? <CloudSun aria-hidden="true" className={className} />
      : <SunMedium aria-hidden="true" className={className} />;
}

export function DashboardOverview({ autoRefresh = false, snapshot }: { autoRefresh?: boolean; snapshot: DashboardSnapshot }) {
  const { metrics } = snapshot;
  const metricCards = [
    { label: "Current solar", value: `${metrics.pvPowerKw.toFixed(2)} kW`, detail: "AC output now", icon: SunMedium, color: "text-solar-strong bg-solar/15" },
    { label: "Energy today", value: `${metrics.energyTodayKwh.toFixed(1)} kWh`, detail: "Since sunrise", icon: Activity, color: "text-primary bg-primary/10" },
    { label: "Home consumption", value: `${metrics.loadPowerKw.toFixed(2)} kW`, detail: "Current demand", icon: House, color: "text-forecast-strong bg-forecast/12" },
    { label: "Battery", value: `${metrics.batterySocPct}%`, detail: metrics.batteryPowerKw < 0 ? `Charging ${Math.abs(metrics.batteryPowerKw).toFixed(2)} kW` : `Discharging ${metrics.batteryPowerKw.toFixed(2)} kW`, icon: BatteryCharging, color: "text-energy-strong bg-energy/12" },
    { label: "Grid flow", value: powerFlowLabel(metrics.gridPowerKw), detail: "Negative means export", icon: UtilityPole, color: "text-primary bg-primary/10" },
  ];
  const timezone = snapshot.site.timezone;
  const chartTime = (value: string) => new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(value));
  const chartDate = (value: string) => new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
  const chartMiddle = new Date((new Date(snapshot.dayWindow.startAt).getTime() + new Date(snapshot.dayWindow.endAt).getTime()) / 2).toISOString();
  const dashboardChartPoints = snapshot.intraday.map((point) => ({
    id: point.observedAt,
    dateTime: point.observedAt,
    axisLabel: chartTime(point.observedAt),
    tooltipLabel: `${chartDate(point.observedAt)} · ${chartTime(point.observedAt)}`,
    generation: point.generationKw,
    consumption: point.consumptionKw,
    breakBefore: point.gapBefore,
  }));

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
          <time dateTime={snapshot.observedAt}>{new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(snapshot.observedAt))}</time>
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

      <div className="space-y-6">
        <Card className="mx-auto w-full max-w-6xl shadow-xs" data-testid="dashboard-observed-power-card">
          <CardHeader>
            <CardTitle><h2>Recent observed power</h2></CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <InteractivePowerChart
              ariaLabel="Intraday solar generation and household consumption"
              axisTicks={[
                { label: "00:00", position: 0 },
                { label: chartTime(chartMiddle), position: 0.5 },
                { label: chartTime(snapshot.dayWindow.endAt), position: 1 },
              ]}
              description="Amber shows observed solar power. Blue shows observed household demand from midnight through the latest stored reading."
              domain={snapshot.dayWindow}
              points={dashboardChartPoints}
              seriesLabels={{ generation: "Generated", consumption: "Consumed" }}
              unit="kW"
              xAxisLabel={`Site local time (${timezone})`}
            />
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-solar" />Solar generation</span><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />Home consumption</span></div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-xs" data-testid="dashboard-weather-landscape">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><CardTitle><h2>Weather & solar conditions</h2></CardTitle><CardDescription>Site-specific Open-Meteo context from the coordinates in System Configuration.</CardDescription></div>
              <Badge variant="outline" className={metrics.weather.freshness === "STALE" ? "border-alert-warning/30 bg-alert-warning/10 text-solar-strong" : "border-primary/20 bg-primary/8 text-primary"}>
                {metrics.weather.freshness === "FRESH" ? "Fresh" : metrics.weather.freshness === "STALE" ? "Stale" : "Gateway fallback"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[minmax(20rem,.68fr)_minmax(0,1.32fr)]">
            <div className="space-y-4">
            <div className="rounded-2xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklab,var(--primary)_68%,black))] p-5 text-primary-foreground">
              <div className="flex items-start justify-between gap-4"><div><p className="text-5xl font-semibold tracking-[-0.05em]">{metrics.weather.temperatureC}°</p><p className="mt-2 font-semibold">{metrics.weather.condition}</p><p className="mt-1 text-xs text-primary-foreground/80">{metrics.weather.temperatureLabel}</p></div>{weatherIcon(metrics.weather.condition, "size-14 text-solar drop-shadow-sm")}</div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-primary-foreground/20 pt-4"><div><p className="text-xs text-primary-foreground/80">{metrics.weather.irradianceLabel}</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.weather.irradianceWm2} W/m²</p></div><div className="text-right"><p className="text-xs text-primary-foreground/80">Rain chance</p><p className="mt-1 font-mono text-xl font-semibold">{metrics.weather.hourly[0]?.precipitationProbabilityPct ?? metrics.weather.cloudCoverPct ?? 0}%</p></div></div>
            </div>
            <dl className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
              <div className="rounded-xl border bg-muted/35 p-3"><Droplets aria-hidden="true" className="size-4 text-primary" /><dt className="mt-2 text-[11px] text-muted-foreground">Humidity</dt><dd className="mt-0.5 text-sm font-semibold">{metrics.weather.relativeHumidityPct == null ? "—" : `${metrics.weather.relativeHumidityPct}%`}</dd></div>
              <div className="rounded-xl border bg-muted/35 p-3"><CloudRain aria-hidden="true" className="size-4 text-primary" /><dt className="mt-2 text-[11px] text-muted-foreground">Cloud / rain</dt><dd className="mt-0.5 text-sm font-semibold">{metrics.weather.cloudCoverPct == null ? "—" : `${metrics.weather.cloudCoverPct}% · ${metrics.weather.precipitationMm ?? 0} mm`}</dd></div>
              <div className="rounded-xl border bg-muted/35 p-3"><Wind aria-hidden="true" className="size-4 text-primary" /><dt className="mt-2 text-[11px] text-muted-foreground">Wind</dt><dd className="mt-0.5 text-sm font-semibold">{metrics.weather.windSpeedKmh == null ? "—" : `${metrics.weather.windSpeedKmh} km/h`}</dd></div>
            </dl>
            </div>
            <div className="space-y-5">
            {metrics.weather.hourly.length ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Next 12 hours</p><div aria-label="Hourly weather forecast" className="flex gap-2 overflow-x-auto pb-2" role="region" tabIndex={0}>{metrics.weather.hourly.map((point) => <div className="min-w-20 rounded-xl border bg-muted/25 p-3 text-center" key={point.validAt}><time className="text-xs text-muted-foreground" dateTime={point.validAt}>{chartTime(point.validAt)}</time>{weatherIcon(point.condition, "mx-auto my-2 size-5 text-solar-strong")}<p className="text-sm font-semibold">{point.temperatureC == null ? "—" : `${Math.round(point.temperatureC)}°`}</p><p className="mt-1 text-[10px] text-muted-foreground">{point.precipitationProbabilityPct ?? 0}% rain</p></div>)}</div></div> : null}
            {metrics.weather.daily.length ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Seven-day weather</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{metrics.weather.daily.map((day) => <div className="rounded-xl border p-2 text-center" key={day.dateKey}><p className="text-xs font-semibold">{day.label}</p>{weatherIcon(day.condition, "mx-auto my-2 size-5 text-solar-strong")}<p className="text-xs">{day.temperatureMaxC == null ? "—" : Math.round(day.temperatureMaxC)}° <span className="text-muted-foreground">{day.temperatureMinC == null ? "—" : Math.round(day.temperatureMinC)}°</span></p></div>)}</div></div> : null}
            </div>
            <div className="grid gap-3 border-t pt-4 xl:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <div className="rounded-xl border border-dashed p-3 text-xs leading-5 text-muted-foreground"><p className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>Location from System Configuration · {snapshot.site.latitude?.toFixed(4) ?? "—"}, {snapshot.site.longitude?.toFixed(4) ?? "—"} · {timezone}</span></p></div>
                <div className="text-xs leading-5 text-muted-foreground"><p>{metrics.weather.sourceLabel} · fetched <time dateTime={metrics.weather.fetchedAt}>{new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(metrics.weather.fetchedAt))}</time></p>{metrics.weather.source === "OPEN_METEO" ? <a className="font-medium text-primary hover:underline" href="https://open-meteo.com/" rel="noreferrer" target="_blank">Weather data by Open-Meteo.com</a> : null}</div>
              </div>
              <DynamicDataControls autoRefresh={autoRefresh} compact siteId={snapshot.site.id} weatherFetchedAt={metrics.weather.fetchedAt} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="shadow-xs">
          <CardHeader><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><CardTitle><h2>48-hour AI forecast</h2></CardTitle><CardDescription className="mt-1">A rolling now-to-48-hours window, recalculated on each hourly page update from the latest stored model run.</CardDescription></div><Badge variant="outline">Hourly rolling view</Badge></div></CardHeader>
          <CardContent className="space-y-3">
            {snapshot.forecast.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">No stored AI forecast is available yet. Sync the site weather and generate a forecast to add the next 48-hour planning summary.</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">{snapshot.forecast.map((day, index) => <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-solar/12 via-card to-primary/5 p-5" key={day.label}><div className="absolute right-3 top-3 text-5xl font-semibold text-solar/10">0{index + 1}</div><SunMedium aria-hidden="true" className="size-6 text-solar-strong" /><p className="mt-4 font-semibold">{day.label}</p><p className="mt-1 text-xs text-muted-foreground">Random Forest · weather-informed</p><p className="mt-5 font-mono text-2xl font-semibold">{day.predictedEnergyKwh.toFixed(1)} kWh</p><p className="text-xs text-muted-foreground">predicted generation</p></div>)}</div>
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
