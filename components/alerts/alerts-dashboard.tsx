"use client";

import { AlertTriangle, BatteryWarning, CheckCircle2, CircleAlert, CloudCog, Gauge, History, PlugZap, RefreshCw, Router, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertIncidentView, AlertsView } from "@/lib/alerts/types";
import { cn } from "@/lib/utils";

type Filter = "OPEN" | "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "ALL";
const severityStyles = {
  CRITICAL: "border-destructive/30 bg-destructive/10 text-destructive",
  WARNING: "border-solar/35 bg-solar/12 text-solar-strong",
  INFO: "border-primary/25 bg-primary/8 text-primary",
};
const typeIcons = {
  GRID_OUTAGE: PlugZap, GATEWAY_OFFLINE: Router, DEVICE_OFFLINE: CloudCog,
  INVERTER_FAULT: TriangleAlert, BATTERY_LOW: BatteryWarning, PV_UNDERPERFORMANCE: Gauge,
};

function formatLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}
function formatEvidenceValue(value: unknown) {
  if (value === null) return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
  return String(value);
}
function dateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function matchesFilter(incident: AlertIncidentView, filter: Filter) {
  if (filter === "ALL") return true;
  if (filter === "OPEN") return incident.status !== "RESOLVED";
  return incident.status === filter;
}
function recalculateSummary(incidents: AlertIncidentView[]) {
  const openIncidents = incidents.filter((item) => item.status !== "RESOLVED");
  return {
    open: openIncidents.length,
    critical: openIncidents.filter((item) => item.severity === "CRITICAL").length,
    acknowledged: incidents.filter((item) => item.status === "ACKNOWLEDGED").length,
    resolved: incidents.filter((item) => item.status === "RESOLVED").length,
  };
}

export function AlertsDashboard({ initialView }: { initialView: AlertsView }) {
  const [view, setView] = useState(initialView);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const incidents = useMemo(() => view.incidents.filter((item) => matchesFilter(item, filter)), [filter, view.incidents]);

  async function mutateIncident(incident: AlertIncidentView, action: "ACKNOWLEDGE" | "RESOLVE") {
    setPendingId(incident.id);
    try {
      const response = await fetch(`/api/sites/${view.site.id}/alerts/${incident.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "The incident could not be updated.");
      const updated = payload.data.incident as AlertIncidentView;
      setView((current) => {
        const nextIncidents = current.incidents.map((item) => item.id === updated.id ? updated : item);
        return { ...current, incidents: nextIncidents, summary: recalculateSummary(nextIncidents) };
      });
      toast.success(action === "ACKNOWLEDGE" ? "Incident acknowledged" : "Incident resolved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The incident could not be updated.");
    } finally { setPendingId(null); }
  }

  function refreshEvidence() {
    startRefresh(async () => {
      try {
        const response = await fetch(`/api/sites/${view.site.id}/alerts`, { method: "POST" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message ?? "Alert evidence could not be refreshed.");
        setView(payload.data.view);
        toast.success("Alert evidence refreshed");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Alert evidence could not be refreshed."); }
    });
  }

  const summaryCards = [
    { label: "Open incidents", value: view.summary.open, detail: "Active and acknowledged", icon: CircleAlert, style: "bg-destructive/10 text-destructive" },
    { label: "Critical", value: view.summary.critical, detail: "Open incidents needing priority", icon: AlertTriangle, style: "bg-destructive/10 text-destructive" },
    { label: "Acknowledged", value: view.summary.acknowledged, detail: "Seen but still open", icon: ShieldCheck, style: "bg-primary/10 text-primary" },
    { label: "Resolved history", value: view.summary.resolved, detail: "Recovered or manually closed", icon: CheckCircle2, style: "bg-energy/10 text-energy-strong" },
  ];
  const filters: Array<{ value: Filter; label: string }> = [
    { value: "OPEN", label: "Open" }, { value: "ACTIVE", label: "Active" },
    { value: "ACKNOWLEDGED", label: "Acknowledged" }, { value: "RESOLVED", label: "Resolved" },
    { value: "ALL", label: "All history" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Incident operations</p><Badge variant="outline">{view.site.mode === "SIMULATED" ? "Virtual site" : "Hardware site"}</Badge></div>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Alerts</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">{view.site.name} · evidence-based incidents for connectivity, grid, inverter, battery, and solar performance.</p>
        </div>
        <Button disabled={isRefreshing} onClick={refreshEvidence} variant="outline"><RefreshCw aria-hidden="true" className={cn("size-4", isRefreshing && "animate-spin motion-reduce:animate-none")} />{isRefreshing ? "Evaluating…" : "Evaluate current evidence"}</Button>
      </header>

      <section aria-label="Alert summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, detail, icon: Icon, style }) => <Card key={label}><CardHeader className="flex-row items-start justify-between gap-3"><div><CardDescription>{label}</CardDescription><CardTitle className="mt-1 text-3xl">{value}</CardTitle></div><span className={cn("grid size-10 place-items-center rounded-xl", style)}><Icon aria-hidden="true" className="size-5" /></span></CardHeader><CardContent className="text-xs text-muted-foreground">{detail}</CardContent></Card>)}
      </section>

      <Card className="border-primary/20 bg-primary/[0.04]"><CardContent className="flex items-start gap-3 py-4"><ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-6 text-muted-foreground">These are rules-based operational signals, not AI diagnoses. Power cuts require sustained low grid voltage; solar underperformance requires sustained daylight evidence. Confirm physical equipment before taking safety-critical action.</p></CardContent></Card>

      <section aria-labelledby="incident-list-heading" className="space-y-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Incident lifecycle</p><h2 className="mt-1 font-heading text-2xl font-semibold" id="incident-list-heading">{view.summary.open} open incident{view.summary.open === 1 ? "" : "s"}</h2></div>
          <div aria-label="Filter incidents" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1.5">{filters.map((item) => <Button aria-pressed={filter === item.value} className="h-8" key={item.value} onClick={() => setFilter(item.value)} size="sm" variant={filter === item.value ? "default" : "ghost"}>{item.label}</Button>)}</div>
        </div>

        {incidents.length ? <div className="grid gap-4 xl:grid-cols-2">{incidents.map((incident) => {
          const Icon = typeIcons[incident.type];
          return <Card className={cn(incident.status !== "RESOLVED" && incident.severity === "CRITICAL" && "border-destructive/30")} key={incident.id}>
            <CardHeader><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", incident.severity === "CRITICAL" ? "bg-destructive/10 text-destructive" : "bg-solar/12 text-solar-strong")}><Icon aria-hidden="true" className="size-5" /></span><div className="min-w-0"><CardTitle><h3>{incident.title}</h3></CardTitle><CardDescription className="mt-1 leading-5">{incident.summary}</CardDescription></div></div><div className="flex shrink-0 flex-col items-end gap-1.5"><Badge className={severityStyles[incident.severity]} variant="outline">{formatLabel(incident.severity)}</Badge><Badge variant="outline">{formatLabel(incident.status)}</Badge></div></div></CardHeader>
            <CardContent className="space-y-4"><div className="grid gap-3 rounded-xl border bg-muted/25 p-3 sm:grid-cols-2">{Object.entries(incident.evidence).slice(0, 6).map(([key, value]) => <div key={key}><p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{formatLabel(key)}</p><p className="mt-1 break-words text-sm font-medium">{formatEvidenceValue(value)}</p></div>)}</div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div className="space-y-1 text-xs text-muted-foreground"><p><span>{incident.evidenceQuality === "SIMULATED" ? "Simulator evidence" : incident.evidenceQuality === "MEASURED" ? "Measured evidence" : "Mixed evidence"}</span><span> · seen {incident.occurrenceCount} time{incident.occurrenceCount === 1 ? "" : "s"}</span></p><p>Last detected {dateTime(incident.lastDetectedAt, view.site.timezone)}</p></div>
                {incident.status !== "RESOLVED" ? <div className="flex gap-2">{incident.status === "ACTIVE" && <Button aria-label={`Acknowledge ${incident.title}`} disabled={pendingId === incident.id} onClick={() => mutateIncident(incident, "ACKNOWLEDGE")} size="sm" variant="outline">Acknowledge</Button>}<Button aria-label={`Resolve ${incident.title}`} disabled={pendingId === incident.id} onClick={() => mutateIncident(incident, "RESOLVE")} size="sm">Resolve</Button></div> : <span className="flex items-center gap-1.5 text-xs font-medium text-energy-strong"><CheckCircle2 aria-hidden="true" className="size-4" />Resolved {incident.resolvedAt ? dateTime(incident.resolvedAt, view.site.timezone) : ""}</span>}
              </div>
            </CardContent>
          </Card>;
        })}</div> : <Card><CardHeader className="items-center py-12 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-energy/10 text-energy-strong"><History aria-hidden="true" className="size-6" /></span><CardTitle className="mt-2">No incidents in this view</CardTitle><CardDescription>{filter === "OPEN" ? "Current evidence has not crossed an alert threshold." : "Choose another lifecycle filter or evaluate current evidence."}</CardDescription></CardHeader></Card>}
      </section>
    </main>
  );
}
