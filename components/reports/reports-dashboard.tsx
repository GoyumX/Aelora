"use client";

import { AlertTriangle, BatteryCharging, CalendarDays, CheckCircle2, Download, FileSpreadsheet, FileText, Gauge, Leaf, LoaderCircle, ShieldCheck, SunMedium, UtilityPole, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportPeriodRequest, ReportsView } from "@/lib/reports/report-service";

function energy(value: number) { return `${value.toFixed(1)} kWh`; }
function percent(value: number | null) { return value === null ? "Insufficient evidence" : `${value.toFixed(1)}%`; }

function GenerateReportButton({ period, siteId, onGenerated }: { period: ReportPeriodRequest & { label: string }; siteId: string; onGenerated: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = period.type === "WEEKLY" ? "weekly" : "monthly";
  async function generate() {
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: period.type, from: period.from, to: period.to }) });
      if (!response.ok) throw new Error("Report generation failed.");
      onGenerated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report generation failed.");
    } finally { setPending(false); }
  }
  return <div className="space-y-2"><Button aria-label={`Generate ${label} report for ${period.label}`} className="w-full justify-between" disabled={pending} onClick={generate} size="lg" variant={period.type === "WEEKLY" ? "default" : "outline"}><span className="flex items-center gap-2">{pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <CalendarDays aria-hidden="true" className="size-4" />}Generate {label} report</span><span className="text-xs opacity-90">{period.label}</span></Button>{error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}</div>;
}

export function ReportsDashboard({ view }: { view: ReportsView }) {
  const router = useRouter();
  const latest = view.reports[0]?.payload;
  const summaryCards = latest ? [
    { label: "Solar generation", value: energy(latest.energy.generationKwh), detail: latest.period.label, icon: SunMedium, tone: "bg-solar/12 text-solar-strong" },
    { label: "Home consumption", value: energy(latest.energy.consumptionKwh), detail: `${latest.energy.selfSufficiencyPct.toFixed(1)}% solar self-sufficient`, icon: Zap, tone: "bg-primary/10 text-primary" },
    { label: "Grid balance", value: energy(latest.energy.gridImportKwh - latest.energy.gridExportKwh), detail: `${energy(latest.energy.gridImportKwh)} imported · ${energy(latest.energy.gridExportKwh)} exported`, icon: UtilityPole, tone: "bg-primary/10 text-primary" },
    { label: "Performance ratio", value: percent(latest.performance.performanceRatioPct), detail: `${latest.performance.availabilityPct.toFixed(1)}% telemetry availability`, icon: Gauge, tone: "bg-energy/10 text-energy-strong" },
  ] : [];

  return <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
    <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Stable exports</p><Badge variant="outline">{view.site.mode === "SIMULATED" ? "Virtual site" : "Measured site"}</Badge>{latest ? <Badge className="border-energy/25 bg-energy/10 text-energy-strong" variant="outline"><ShieldCheck aria-hidden="true" className="mr-1 size-3" />Snapshot ready</Badge> : null}</div><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Reports</h1><p className="mt-3 max-w-3xl text-muted-foreground">Generate immutable weekly and monthly evidence snapshots for {view.site.name}. Every export reconciles with the same stored telemetry used by Historical Analytics.</p></div>
      <div className="grid min-w-0 gap-2 sm:min-w-[30rem]">{view.suggestedPeriods.map((period) => <GenerateReportButton key={`${period.type}-${period.from}`} onGenerated={() => router.refresh()} period={period} siteId={view.site.id} />)}</div>
    </header>

    {latest ? <>
      <section aria-label="Latest report summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map(({ label, value, detail, icon: Icon, tone }) => <Card key={label}><CardHeader className="gap-3"><span className={`grid size-9 place-items-center rounded-lg ${tone}`}><Icon aria-hidden="true" className="size-4.5" /></span><div><CardDescription>{label}</CardDescription><CardTitle className="mt-1 text-2xl">{value}</CardTitle></div></CardHeader><CardContent className="text-xs leading-5 text-muted-foreground">{detail}</CardContent></Card>)}</section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,.7fr)]">
        <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Latest snapshot</p><CardTitle className="mt-2"><h2>{latest.period.type === "WEEKLY" ? "Weekly" : "Monthly"} evidence · {latest.period.label}</h2></CardTitle><CardDescription className="mt-1">Generated {new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: view.site.timezone }).format(new Date(latest.generatedAt))}</CardDescription></div><Badge variant="outline">{latest.provenance.sourceLabel}</Badge></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-xl border p-4"><BatteryCharging aria-hidden="true" className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Battery throughput</p><p className="mt-1 font-semibold">{energy(latest.energy.batteryChargeKwh)} charged</p><p className="text-xs text-muted-foreground">{energy(latest.energy.batteryDischargeKwh)} discharged</p></div><div className="rounded-xl border p-4"><AlertTriangle aria-hidden="true" className="size-5 text-destructive" /><p className="mt-3 text-xs text-muted-foreground">Operational incidents</p><p className="mt-1 font-semibold">{latest.alerts.total} total · {latest.alerts.critical} critical</p><p className="text-xs text-muted-foreground">{latest.alerts.gridOutageMinutes.toFixed(1)} grid-outage minutes</p></div><div className="rounded-xl border p-4"><Leaf aria-hidden="true" className="size-5 text-energy-strong" /><p className="mt-3 text-xs text-muted-foreground">Illustrative avoided emissions</p><p className="mt-1 font-semibold">{latest.environmentalEstimate.avoidedCo2eKg.toFixed(1)} kg CO₂e</p><p className="text-xs text-muted-foreground">Uses a disclosed {latest.environmentalEstimate.factorKgPerKwh} kg/kWh factor</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle><h2>Evidence quality</h2></CardTitle><CardDescription>Report values remain traceable and do not mix predictions with measurements.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Telemetry completeness</span><strong>{latest.provenance.completenessPct.toFixed(1)}%</strong></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Forecast labels</span><strong>{latest.forecastAccuracy.sampleCount}</strong></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Forecast MAE</span><strong>{latest.forecastAccuracy.maeKwh === null ? "Collecting evidence" : `${latest.forecastAccuracy.maeKwh.toFixed(3)} kWh`}</strong></div><div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><CheckCircle2 aria-hidden="true" className="mb-2 size-4 text-primary" />Historical energy is deterministic aggregation. Forecast accuracy is shown only when completed intervals have verification records.</div></CardContent></Card>
      </section>
    </> : <Card className="border-dashed"><CardHeader><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><FileText aria-hidden="true" className="size-5" /></span><CardTitle className="mt-3"><h2>No report snapshots yet</h2></CardTitle><CardDescription>Choose the last completed week or month above. Aelora will freeze the current telemetry, performance, forecast-verification and incident evidence into one versioned record.</CardDescription></CardHeader></Card>}

    <section aria-labelledby="report-history-heading" className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Archive</p><h2 className="mt-1 font-heading text-2xl font-semibold" id="report-history-heading">Generated reports</h2></div>{view.reports.length ? <div className="grid gap-4 lg:grid-cols-2">{view.reports.map((report) => <Card key={report.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle><h3>{report.payload.period.type === "WEEKLY" ? "Weekly" : "Monthly"} · {report.payload.period.label}</h3></CardTitle><CardDescription className="mt-1">Immutable snapshot · version {report.payload.schemaVersion} · hash {report.dataHash.slice(0, 10)}…</CardDescription></div><Badge variant="outline">{report.payload.provenance.completenessPct.toFixed(1)}% complete</Badge></div></CardHeader><CardContent className="flex flex-wrap gap-2"><a className={buttonVariants({ variant: "outline" })} href={`/api/sites/${view.site.id}/reports/${report.id}/csv`}><FileSpreadsheet aria-hidden="true" className="size-4" />Download CSV</a><a className={buttonVariants()} href={`/api/sites/${view.site.id}/reports/${report.id}/pdf`}><Download aria-hidden="true" className="size-4" />Download PDF</a></CardContent></Card>)}</div> : <p className="text-sm text-muted-foreground">Generated weekly and monthly snapshots will appear here.</p>}</section>

    <Card className="border-primary/20 bg-primary/5"><CardHeader><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>What a report contains</h2></CardTitle><CardDescription className="mt-1 max-w-4xl leading-6">Generation, consumption, self-consumption, self-sufficiency, grid import/export, battery throughput, performance, forecast verification, incidents, downtime and an explicitly illustrative environmental estimate. CSV preserves detailed daily evidence; PDF provides the presentation-ready summary. Scheduling is intentionally deferred until on-demand generation is proven idempotent.</CardDescription></div></div></CardHeader></Card>
  </main>;
}
