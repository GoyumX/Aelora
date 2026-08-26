"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  Gauge,
  SunMedium,
  UtilityPole,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { InteractivePowerChart } from "@/components/charts/interactive-power-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { historyToCsv, type HistoricalTelemetry } from "@/lib/telemetry/history";

function kwh(value: number) {
  return `${(value / 1_000).toFixed(1)} kWh`;
}

function comparison(value: number | null) {
  return value === null ? "No prior data" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function HistoricalPowerChart({ history }: { history: HistoricalTelemetry }) {
  const chartData = history.points.map((point) => ({
    id: point.bucketStart,
    dateTime: point.bucketStart,
    axisLabel: point.label,
    tooltipLabel: point.label,
    generation: point.generationWh / 1_000,
    consumption: point.consumptionWh / 1_000,
  }));

  return (
    <div aria-label="Generation and consumption history" role="group">
      <InteractivePowerChart
        ariaLabel="Generation and consumption history"
        decimals={1}
        description="Amber represents solar generation and blue represents site consumption for each stored historical bucket."
        points={chartData}
        seriesLabels={{ generation: "Generation", consumption: "Consumption" }}
        tooltipAxisLabel="Period"
        unit="kWh"
        xAxisLabel={`Historical ${history.range.grain} (${history.site.timezone})`}
        yAxisLabel="Energy (kWh)"
      />
      <p className="mt-2 text-xs text-muted-foreground">Hover or focus a point to see its historical period and exact energy values.</p>
      <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
        <span>● Solar generation</span>
        <span>● Consumption</span>
      </div>
    </div>
  );
}

export function HistoricalAnalytics({ history }: { history: HistoricalTelemetry }) {
  const rangeDurationHours = (new Date(history.range.to).getTime() - new Date(history.range.from).getTime()) / 3_600_000;
  const selectedDate = rangeDurationHours <= 26 ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: history.site.timezone }).format(new Date(history.range.from)) : undefined;
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(historyToCsv(history.points))}`;
  const cards = [
    { label: "Generation", value: kwh(history.summary.generationWh), detail: `${comparison(history.comparison.generationChangePct)} vs prior period`, icon: SunMedium },
    { label: "Consumption", value: kwh(history.summary.consumptionWh), detail: `${comparison(history.comparison.consumptionChangePct)} vs prior period`, icon: Zap },
    { label: "Grid import", value: kwh(history.summary.importWh), detail: `Exported ${kwh(history.summary.exportWh)}`, icon: UtilityPole },
    { label: "Solar self-consumption", value: `${history.summary.selfConsumptionPct.toFixed(1)}%`, detail: "Generation used on site", icon: Gauge },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Energy history</p>
            <Badge variant="outline">Simulated history</Badge>
            <Badge className="border-energy/25 bg-energy/10 text-energy-strong" variant="outline">
              {history.completenessPct}% complete
            </Badge>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Historical analytics
          </h1>
          <p className="mt-3 text-muted-foreground">
            {history.site.name} · stored hourly telemetry, rendered in {history.site.timezone}
          </p>
        </div>
        <a
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          download={`aelora-${history.range.grain}-history.csv`}
          href={csvHref}
        >
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </a>
      </header>

      <div aria-label="Historical range, date, and granularity" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3" role="group">
        <nav aria-label="Historical range" className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((days) => (
          <Link className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent" href={`?range=${days}&grain=${history.range.grain}`} key={days}>
            {days} days
          </Link>
        ))}
        </nav>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
        <nav aria-label="Historical granularity" className="flex flex-wrap items-center gap-2">
        {(["day", "week", "month"] as const).map((grain) => (
          <Link className={`rounded-lg px-3 py-1.5 text-sm capitalize ${history.range.grain === grain ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`} href={`?range=90&grain=${grain}`} key={grain}>
            {grain}
          </Link>
        ))}
        </nav>
        <form action="/historical-analytics" className="ml-auto flex flex-wrap items-end gap-2" method="get">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground" htmlFor="history-date"><CalendarDays aria-hidden="true" className="size-4 text-primary" />Specific date</label>
            <input aria-label="Choose a specific date" className="h-9 min-w-40 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" defaultValue={selectedDate} id="history-date" name="date" required type="date" />
          </div>
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85" type="submit">View date</button>
        </form>
      </div>

      <section aria-label="Historical summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-4.5" /></span>
              <CardDescription className="mt-2">{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {detail.startsWith("+") ? <ArrowUpRight aria-hidden="true" className="size-3.5 text-energy-strong" /> : <ArrowDownRight aria-hidden="true" className="size-3.5" />}
              {detail}
            </CardContent>
          </Card>
        ))}
      </section>

      {history.points.length ? (
        <div>
          <Card>
            <CardHeader>
              <CardTitle><h2>Generation and consumption</h2></CardTitle>
              <CardDescription>Move across or focus a point to inspect the stored {history.range.grain} bucket.</CardDescription>
            </CardHeader>
            <CardContent><HistoricalPowerChart history={history} /></CardContent>
          </Card>
        </div>
      ) : (
        <Card><CardHeader><CardTitle>No telemetry in this range</CardTitle><CardDescription>Generate or ingest readings, then choose a range containing stored samples.</CardDescription></CardHeader></Card>
      )}
    </main>
  );
}
