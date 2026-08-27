"use client";

import {
  CalendarRange,
  CloudSun,
  RefreshCw,
  Sparkles,
  SunMedium,
  Waves,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DynamicDataControls } from "@/components/shared/dynamic-data-controls";
import { InteractivePowerChart } from "@/components/charts/interactive-power-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SolarForecastView } from "@/lib/forecast/forecast-service";
import type {
  ForecastCalibrationSlice,
  ForecastEvaluationView,
  ForecastPromotionStatus,
} from "@/lib/forecast/verification";

function energy(value: number) {
  return `${value.toFixed(1)} kWh`;
}

function power(value: number) {
  return `${value.toFixed(2)} kW`;
}

function verificationEnergy(value: number | null) {
  return value == null ? "—" : `${value.toFixed(2)} kWh`;
}

function percentage(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function dateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function loadMethodLabel(method: string) {
  if (method === "HISTORICAL_HOURLY_MEDIAN") return "Historical hourly median; the site median fills hours without samples";
  return "Unavailable — waiting for household telemetry history";
}

type ForecastHorizon = 24 | 48 | 168;

function calibrationForLead(calibration: ForecastCalibrationSlice[], leadHours: number) {
  const key = leadHours <= 24 ? "H24" : leadHours <= 48 ? "H48" : "H168";
  return calibration.find((slice) => slice.key === key);
}

function evidenceLabel(quality: ForecastEvaluationView["evidenceQuality"] | undefined) {
  if (quality === "SIMULATED") return "Simulator evidence";
  if (quality === "MEASURED") return "Measured evidence";
  if (quality === "MIXED") return "Mixed evidence";
  if (quality === "ESTIMATED") return "Estimated evidence";
  return "Collecting labels";
}

function promotionLabel(status: ForecastPromotionStatus | undefined) {
  if (status === "REVIEW_REQUIRED") return "Human review required";
  if (status === "GATES_FAILED") return "Quality gates failed";
  if (status === "INSUFFICIENT_EVIDENCE") return "Collecting evidence";
  return "Blocked from promotion";
}

function dailyForecast(forecast: SolarForecastView) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: forecast.site.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const groups = new Map<string, { label: string; energy: number; peak: number }>();
  for (const point of forecast.points) {
    const label = formatter.format(new Date(point.validAt));
    const current = groups.get(label) ?? { label, energy: 0, peak: 0 };
    current.energy += point.estimatedEnergyKwh;
    current.peak = Math.max(current.peak, point.estimatedPowerKw);
    groups.set(label, current);
  }
  return [...groups.values()].slice(0, 7);
}

export function AiForecastDashboard({
  evaluation = null,
  forecast,
  now,
  autoRefresh = false,
  siteId,
}: {
  autoRefresh?: boolean;
  evaluation?: ForecastEvaluationView | null;
  forecast: SolarForecastView | null;
  now: string;
  siteId: string;
}) {
  const router = useRouter();
  const [verificationPending, setVerificationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<ForecastHorizon>(48);
  const referenceTime = useMemo(() => new Date(now), [now]);
  const futureForecast = useMemo(() => forecast ? {
    ...forecast,
    points: forecast.points.filter((point) => new Date(point.validAt) > referenceTime),
  } : null, [forecast, referenceTime]);
  const days = useMemo(() => futureForecast ? dailyForecast(futureForecast) : [], [futureForecast]);

  async function refreshActuals() {
    setVerificationPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/forecast/evaluation`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Completed actuals could not be refreshed.");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Completed actuals could not be refreshed.");
    } finally {
      setVerificationPending(false);
    }
  }

  if (!forecast) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col justify-center gap-6 px-4 py-10 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Intelligence</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">AI Forecast</h1>
        </div>
        <Card className="border-primary/20">
          <CardHeader>
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            <CardTitle className="mt-3">Generate your first forecast</CardTitle>
            <CardDescription className="max-w-2xl leading-6">
              Aelora needs active panel capacity and a complete stored Open-Meteo weather
              horizon. The Next.js server then calls the private model and stores the result.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DynamicDataControls autoRefresh={autoRefresh} forecastCreatedAt={null} showForecast siteId={siteId} weatherFetchedAt={null} />
          </CardContent>
        </Card>
      </main>
    );
  }

  const rollingPoints = futureForecast?.points ?? [];
  const firstValidAt = rollingPoints[0] ? new Date(rollingPoints[0].validAt).getTime() : referenceTime.getTime();
  const first48 = rollingPoints.filter((point) => new Date(point.validAt).getTime() <= firstValidAt + 48 * 60 * 60 * 1000);
  const next24Energy = rollingPoints
    .filter((point) => new Date(point.validAt).getTime() <= firstValidAt + 24 * 60 * 60 * 1000)
    .reduce((sum, point) => sum + point.estimatedEnergyKwh, 0);
  const next48Energy = first48.reduce((sum, point) => sum + point.estimatedEnergyKwh, 0);
  const nextSevenDayEnergy = rollingPoints.slice(0, 168).reduce((sum, point) => sum + point.estimatedEnergyKwh, 0);
  const peakPower = Math.max(0, ...first48.map((point) => point.estimatedPowerKw));
  const chartData = rollingPoints.slice(0, horizon);
  const interactiveChartPoints = chartData.map((point) => {
    const calibration = calibrationForLead(evaluation?.calibration ?? [], point.leadHours);
    const halfWidth = calibration?.status === "READY" ? calibration.halfWidthKwh : null;
    const date = new Date(point.validAt);
    const dateLabel = new Intl.DateTimeFormat("en", { timeZone: forecast.site.timezone, weekday: "short", month: "short", day: "numeric" }).format(date);
    const timeLabel = new Intl.DateTimeFormat("en-GB", { timeZone: forecast.site.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
    return {
      id: point.validAt,
      dateTime: point.validAt,
      axisLabel: horizon === 168 ? `${dateLabel.split(",")[0]} ${timeLabel}` : timeLabel,
      tooltipLabel: `${dateLabel} · ${timeLabel}`,
      generation: point.estimatedPowerKw,
      consumption: point.estimatedLoadPowerKw,
      generationLower: halfWidth == null ? null : Math.max(0, point.estimatedPowerKw - halfWidth),
      generationUpper: halfWidth == null ? null : point.estimatedPowerKw + halfWidth,
    };
  });
  const horizonTitle = horizon === 168 ? "7-day power curve" : `${horizon}-hour power curve`;

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Intelligence</p>
            <Badge className="border-amber-600/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/40 dark:text-amber-200" variant="outline">
              {forecast.model.productionActivationAllowed ? "Active model" : "Inactive challenger"}
            </Badge>
            <Badge variant="outline">Random Forest</Badge>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">AI Forecast</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            {forecast.site.name} · hourly solar-energy outlook in {forecast.site.timezone}
          </p>
        </div>
        <DynamicDataControls autoRefresh={autoRefresh} forecastCreatedAt={forecast.createdAt} showForecast siteId={siteId} weatherFetchedAt={forecast.weather.fetchedAt} />
      </header>

      {error ? <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p> : null}

      <section aria-label="Forecast summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Next 24 hours", value: energy(next24Energy), detail: "Hourly model estimate", icon: SunMedium },
          { label: "Next 48 hours", value: energy(next48Energy), detail: `Peak ${power(peakPower)}`, icon: Waves },
          { label: "7-day outlook", value: energy(nextSevenDayEnergy), detail: `${rollingPoints.filter((point) => point.estimatedPowerKw > 0).length} predicted daylight hours`, icon: CalendarRange },
          { label: "Configured capacity", value: `${forecast.installedCapacityKwp.toFixed(2)} kWp`, detail: "Snapshot used for this run", icon: CloudSun },
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-4.5" /></span>
              <CardDescription className="mt-2">{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="daily-forecast-heading" className="rounded-3xl border bg-gradient-to-br from-primary/8 via-card to-solar/8 p-5 shadow-xs sm:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Primary planning view</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold" id="daily-forecast-heading">Seven-day forecast</h2>
            <p className="mt-2 text-sm text-muted-foreground">Upcoming local days only. The model reruns every 12 hours after fresh site weather is stored.</p>
          </div>
          <Badge className="w-fit border-primary/20 bg-background/70" variant="outline">12-hour model cycle</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day, index) => (
            <Card className={index === 0 ? "border-solar/40 bg-solar/8" : "bg-background/75"} key={day.label}>
              <CardHeader className="gap-2">
                <CardDescription>{index === 0 ? "Today · " : ""}{day.label}</CardDescription>
                <SunMedium aria-hidden="true" className="size-6 text-solar-strong" />
                <CardTitle>{energy(day.energy)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Peak {power(day.peak)}</CardContent>
            </Card>
          ))}
          {!days.length ? <p className="col-span-full rounded-xl border border-dashed p-5 text-sm text-muted-foreground">This run has no upcoming days left. Aelora is requesting fresh weather and a replacement model run.</p> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <CardTitle><h2>{horizonTitle}</h2></CardTitle>
                <CardDescription className="mt-1">AI solar output compared with the home&apos;s stored hourly usage pattern.</CardDescription>
              </div>
              <div aria-label="Forecast chart horizon" className="inline-flex w-fit rounded-lg border bg-muted/45 p-1">
                {([
                  { value: 24, label: "24 hours" },
                  { value: 48, label: "48 hours" },
                  { value: 168, label: "7 days" },
                ] as const).map((option) => (
                  <button
                    aria-pressed={horizon === option.value}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
                    key={option.value}
                    onClick={() => setHorizon(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length ? (
              <InteractivePowerChart
                ariaLabel={`${horizonTitle}: power generated versus household usage`}
                description="Amber is the hourly Random Forest solar estimate. Blue is the historical household load estimate. Both use kilowatts."
                points={interactiveChartPoints}
                seriesLabels={{ generation: "Solar forecast", consumption: "Household usage" }}
                unit="kW"
                xAxisLabel={`Forecast time (${forecast.site.timezone})`}
              />
            ) : <p className="text-sm text-muted-foreground">No future hourly points remain in this run.</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-solar" />Solar generation</span>
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />Household usage</span>
              {evaluation?.calibration.some((slice) => slice.status === "READY") ? <span className="flex items-center gap-2"><span className="w-5 border-t border-dashed border-solar-strong" />90% empirical envelope</span> : null}
              <span className="sm:ml-auto">Usage method: {loadMethodLabel(forecast.loadForecast.method)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle><h2>Forecast provenance</h2></CardTitle>
            <CardDescription>Everything required to reproduce and evaluate this forecast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Model</p><p className="mt-1 font-medium">{forecast.model.name}</p></div>
            <div><p className="text-xs text-muted-foreground">Forecast issued</p><p className="mt-1 font-medium">{dateTime(forecast.issuedAt, forecast.site.timezone)}</p></div>
            <div><p className="text-xs text-muted-foreground">Weather snapshot</p><p className="mt-1 font-medium">{dateTime(forecast.weather.fetchedAt, forecast.site.timezone)}</p></div>
            <p className="border-t pt-4 text-xs text-muted-foreground">{forecast.weather.attribution}</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="verification-heading" className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Model verification</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold" id="verification-heading">Prediction vs actual</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              This proves whether the model is useful: completed forecast hours are compared with what the panels actually produced. The error history calibrates uncertainty and reveals drift instead of asking users to trust an unverified prediction.
            </p>
          </div>
          <Button disabled={verificationPending} onClick={refreshActuals} variant="outline">
            <RefreshCw aria-hidden="true" className={verificationPending ? "animate-spin" : ""} />
            {verificationPending ? "Refreshing actuals…" : "Refresh actuals"}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Observed accuracy</CardTitle>
                  <CardDescription className="mt-1">Daylight hours only; duplicate runs and zero-output night hours are excluded.</CardDescription>
                </div>
                <Badge variant="outline">{evidenceLabel(evaluation?.evidenceQuality)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Verified hours", value: String(evaluation?.overall.sampleCount ?? 0) },
                  { label: "Mean absolute error", value: verificationEnergy(evaluation?.overall.maeKwh ?? null) },
                  { label: "Root mean squared error", value: verificationEnergy(evaluation?.overall.rmseKwh ?? null) },
                  { label: "Weighted error", value: percentage(evaluation?.overall.wMapePct ?? null) },
                ].map((metric) => (
                  <div className="rounded-xl border bg-muted/25 p-4" key={metric.label}>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 font-heading text-xl font-semibold">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div aria-label="Forecast verification by lead time" className="overflow-x-auto rounded-xl border" role="region" tabIndex={0}>
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="bg-muted/45 text-xs text-muted-foreground">
                    <tr><th className="px-4 py-3 font-medium">Forecast lead</th><th className="px-4 py-3 font-medium">Labels</th><th className="px-4 py-3 font-medium">MAE</th><th className="px-4 py-3 font-medium">wMAPE</th><th className="px-4 py-3 font-medium">Calibration</th></tr>
                  </thead>
                  <tbody>
                    {(evaluation?.slices ?? []).map((slice) => {
                      const calibration = evaluation?.calibration.find((item) => item.key === slice.key);
                      return (
                        <tr className="border-t" key={slice.key}>
                          <td className="px-4 py-3 font-medium">{slice.label}</td>
                          <td className="px-4 py-3">{slice.sampleCount}</td>
                          <td className="px-4 py-3">{verificationEnergy(slice.maeKwh)}</td>
                          <td className="px-4 py-3">wMAPE {percentage(slice.wMapePct)}</td>
                          <td className="px-4 py-3">{calibration?.status === "READY" && calibration.halfWidthKwh != null ? `Envelope ±${calibration.halfWidthKwh.toFixed(2)} kWh` : "Collecting"}</td>
                        </tr>
                      );
                    })}
                    {!evaluation?.slices.length ? <tr><td className="px-4 py-5 text-muted-foreground" colSpan={5}>No completed daylight labels yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/25 bg-amber-500/5">
            <CardHeader>
              <CardDescription>Promotion status</CardDescription>
              <CardTitle>{promotionLabel(evaluation?.promotion.status)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">90% retrospective intervals</p>
                <div className="mt-3 space-y-2">
                  {(evaluation?.calibration ?? []).map((slice) => (
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 text-sm" key={slice.key}>
                      <span>{slice.label}</span>
                      <span className="font-medium">{slice.status === "READY" && slice.halfWidthKwh != null ? `±${slice.halfWidthKwh.toFixed(2)} kWh` : `${slice.sampleCount}/24 labels`}</span>
                    </div>
                  ))}
                  {!evaluation ? <p className="text-sm text-muted-foreground">Refresh after forecast hours complete to begin calibration.</p> : null}
                </div>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {(evaluation?.promotion.reasons ?? ["Measured evidence and a human review are required before activation."]).map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              {evaluation ? <p className="border-t pt-4 text-xs text-muted-foreground">Last evaluated {dateTime(evaluation.evaluatedAt, forecast.site.timezone)}</p> : null}
            </CardContent>
          </Card>
        </div>
      </section>

    </main>
  );
}
