import { Activity, AlertTriangle, BarChart3, CheckCircle2, CircleGauge, Clock3, ShieldCheck, SunMedium, TrendingDown } from "lucide-react";
import Link from "next/link";

import { InteractivePowerChart } from "@/components/charts/interactive-power-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArrayPerformance, PerformanceReport } from "@/lib/performance/performance";

function energy(value: number) { return `${(value / 1_000).toFixed(1)} kWh`; }
function power(value: number) { return `${(value / 1_000).toFixed(2)} kWp`; }
function percent(value: number | null) { return value === null ? "Insufficient data" : `${value.toFixed(1)}%`; }

const statusStyles: Record<ArrayPerformance["status"], string> = {
  HEALTHY: "border-energy/25 bg-energy/10 text-energy-strong",
  UNDERPERFORMING: "border-destructive/25 bg-destructive/10 text-destructive",
  INSUFFICIENT_DATA: "border-border bg-muted text-muted-foreground",
};

function statusLabel(status: ArrayPerformance["status"]) {
  if (status === "INSUFFICIENT_DATA") return "Insufficient data";
  return status === "UNDERPERFORMING" ? "Underperforming" : "Healthy";
}

export function PerformanceDashboard({ report }: { report: PerformanceReport }) {
  const underperforming = report.arrays.filter((array) => array.status === "UNDERPERFORMING").length;
  const chartData = report.points.map((point) => ({
    id: point.bucketStart,
    dateTime: point.bucketStart,
    axisLabel: point.label,
    tooltipLabel: point.label,
    generation: point.actualGenerationWh / 1_000,
    consumption: point.expectedGenerationWh / 1_000,
  }));
  const cards = [
    { label: "Actual production", value: energy(report.summary.actualGenerationWh), detail: `${report.range.days}-day stored generation`, icon: SunMedium, accent: "text-solar-strong bg-solar/12" },
    { label: "Predicted production", value: energy(report.summary.expectedGenerationWh), detail: "Irradiance-based expected output", icon: BarChart3, accent: "text-primary bg-primary/10" },
    { label: "Performance ratio", value: percent(report.summary.performanceRatioPct), detail: "Actual divided by predicted output", icon: CircleGauge, accent: "text-energy-strong bg-energy/10" },
    { label: "Estimated losses", value: energy(report.summary.estimatedLossWh), detail: "Predicted output not converted to AC energy", icon: TrendingDown, accent: "text-destructive bg-destructive/10" },
    { label: "Data availability", value: `${report.summary.availabilityPct.toFixed(1)}%`, detail: "Expected telemetry intervals received", icon: Clock3, accent: "text-primary bg-primary/10" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">System health</p>
            <Badge variant="outline">{report.sourceLabel}</Badge>
            <Badge className="border-primary/20 bg-primary/5 text-primary" variant="outline">{power(report.summary.configuredCapacityW)} configured</Badge>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Performance</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">{report.site.name} · measured production compared with irradiance-based predicted production in {report.site.timezone}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card p-1.5" aria-label="Performance range">
          {[7, 30, 90].map((days) => <Link className={`rounded-lg px-3 py-1.5 text-sm font-medium ${report.range.days === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`} href={`?range=${days}`} key={days}>{days} days</Link>)}
        </div>
      </header>

      <section aria-label="Performance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, detail, icon: Icon, accent }) => <Card key={label}><CardHeader className="gap-3"><span className={`grid size-9 place-items-center rounded-lg ${accent}`}><Icon aria-hidden="true" className="size-4.5" /></span><div><CardDescription>{label}</CardDescription><CardTitle className="mt-1 text-2xl">{value}</CardTitle></div></CardHeader><CardContent className="text-xs leading-5 text-muted-foreground">{detail}</CardContent></Card>)}
      </section>

      {report.points.length ? <section className="space-y-4">
        <Card>
          <CardHeader><CardTitle><h2>Actual vs predicted production</h2></CardTitle><CardDescription>Daily AC energy for the selected {report.range.days}-day period. Hover or focus the chart to inspect an exact day.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto w-full max-w-7xl">
              <InteractivePowerChart
                ariaLabel="Actual and predicted generation"
                decimals={1}
                description="The solid amber line is stored production. The dashed blue line is irradiance-based predicted production."
                points={chartData}
                seriesLabels={{ generation: "Actual production", consumption: "Predicted production" }}
                tooltipAxisLabel="Day"
                unit="kWh"
                xAxisLabel={`Local day (${report.site.timezone})`}
                yAxisLabel="Daily energy (kWh)"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-solar/25 bg-solar/8 p-4"><div className="flex items-center gap-3"><span className="h-1 w-10 rounded-full bg-solar" /><strong>Actual production</strong></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Energy recorded from stored gateway readings.</p></div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-3"><span className="w-10 border-t-2 border-dashed border-primary" /><strong>Predicted production</strong></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Expected energy from irradiance, configured capacity, inverter efficiency, and its AC limit.</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className={underperforming ? "border-destructive/25" : "border-energy/25"}>
          <CardContent className="grid gap-4 py-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <span className={`grid size-11 place-items-center rounded-xl ${underperforming ? "bg-destructive/10 text-destructive" : "bg-energy/10 text-energy-strong"}`}>{underperforming ? <AlertTriangle aria-hidden="true" className="size-5" /> : <ShieldCheck aria-hidden="true" className="size-5" />}</span>
            <div><CardTitle><h2>{underperforming ? `${underperforming} array${underperforming === 1 ? "" : "s"} need attention` : "Arrays are within range"}</h2></CardTitle><CardDescription className="mt-1">{underperforming ? "At least one array crossed the evidence threshold; review its detailed card below." : "Every assessable array has at least 90% availability and at least 80% of predicted production."} This is a diagnostic signal, not a confirmed hardware fault.</CardDescription></div>
          </CardContent>
        </Card>
      </section> : <Card><CardHeader><CardTitle>No performance evidence in this range</CardTitle><CardDescription>Run the virtual gateway or ingest measured telemetry, then select a range containing stored readings.</CardDescription></CardHeader></Card>}

      <section aria-labelledby="array-performance-heading" className="space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Equipment evidence</p><h2 className="mt-1 font-heading text-2xl font-semibold" id="array-performance-heading">Array performance</h2></div><p className="text-sm text-muted-foreground">Matched by configured array name and gateway observation.</p></div>
        {report.arrays.length ? <div className="grid gap-4 lg:grid-cols-2">{report.arrays.map((array) => <Card key={array.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle><h3>{array.name}</h3></CardTitle><CardDescription className="mt-1">{power(array.ratedCapacityW)} · {array.observationCount} matched observations</CardDescription></div><Badge className={statusStyles[array.status]} variant="outline">{statusLabel(array.status)}</Badge></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Actual</p><p className="mt-1 font-semibold">{energy(array.actualGenerationWh)}</p></div><div><p className="text-xs text-muted-foreground">Performance ratio</p><p className="mt-1 font-semibold">{percent(array.performanceRatioPct)}</p></div><div><p className="text-xs text-muted-foreground">Availability</p><p className="mt-1 font-semibold">{array.observationCount ? `${array.availabilityPct.toFixed(1)}%` : "No evidence"}</p></div><p className="sm:col-span-3 flex items-start gap-2 border-t pt-4 text-sm text-muted-foreground">{array.status === "HEALTHY" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-energy-strong" /> : array.status === "UNDERPERFORMING" ? <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" /> : <Activity aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}{array.explanation}</p></CardContent></Card>)}</div> : <Card><CardHeader><CardTitle>No configured arrays</CardTitle><CardDescription>Add solar arrays in System Configuration before evaluating array-level performance.</CardDescription></CardHeader></Card>}
      </section>
    </main>
  );
}
