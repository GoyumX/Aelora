import { z } from "zod";

export const historyGrains = ["day", "week", "month"] as const;
export type HistoryGrain = (typeof historyGrains)[number];

export const historyQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  grain: z.enum(historyGrains).default("day"),
}).superRefine((value, context) => {
  const from = new Date(`${value.from}T00:00:00.000Z`);
  const to = new Date(`${value.to}T00:00:00.000Z`);
  if (from >= to) context.addIssue({ code: "custom", path: ["to"], message: "The end date must be after the start date." });
  if (to.getTime() - from.getTime() > 366 * 86_400_000) context.addIssue({ code: "custom", path: ["to"], message: "Historical ranges are limited to 366 days." });
});

export type HistoryReading = {
  observedAt: Date;
  pvPowerW: number;
  loadPowerW: number;
  gridPowerW: number;
  batteryPowerW: number;
  irradianceWm2: number;
  quality: "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";
};

export type HistoryPoint = {
  bucketStart: string;
  label: string;
  generationWh: number;
  consumptionWh: number;
  importWh: number;
  exportWh: number;
  batteryChargeWh: number;
  batteryDischargeWh: number;
  averageIrradianceWm2: number;
  sampleCount: number;
};

export type HistoricalTelemetry = {
  site: { id: string; name: string; timezone: string };
  range: { from: string; to: string; grain: HistoryGrain };
  points: HistoryPoint[];
  summary: { generationWh: number; consumptionWh: number; importWh: number; exportWh: number; selfConsumptionPct: number };
  comparison: { generationChangePct: number | null; consumptionChangePct: number | null };
  completenessPct: number;
};

export function inferSampleIntervalMinutes(readings: Array<{ observedAt: Date }>, fallback = 60) {
  if (readings.length < 2) return fallback;
  const intervals = readings.slice(1).map((reading, index) => (reading.observedAt.getTime() - readings[index].observedAt.getTime()) / 60_000).filter((value) => value > 0 && value <= 24 * 60).sort((a, b) => a - b);
  if (!intervals.length) return fallback;
  return intervals[Math.floor((intervals.length - 1) / 2)];
}

function localParts(date: Date, timezone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
}

function bucket(date: Date, grain: HistoryGrain, timezone: string) {
  const parts = localParts(date, timezone);
  let key = `${parts.year}-${parts.month}-${parts.day}`;
  if (grain === "week") {
    const utcDay = new Date(`${key}T00:00:00.000Z`);
    const offset = (utcDay.getUTCDay() + 6) % 7;
    utcDay.setUTCDate(utcDay.getUTCDate() - offset);
    key = utcDay.toISOString().slice(0, 10);
  } else if (grain === "month") key = `${parts.year}-${parts.month}-01`;
  return key;
}

function labelFor(key: string, grain: HistoryGrain, timezone: string) {
  return new Intl.DateTimeFormat("en", grain === "month" ? { month: "short", year: "numeric", timeZone: timezone } : { month: "short", day: "numeric", timeZone: timezone }).format(new Date(`${key}T12:00:00.000Z`));
}

export function aggregateTelemetry(readings: HistoryReading[], grain: HistoryGrain, timezone: string, from: Date, to: Date, intervalMinutes: number) {
  const factor = intervalMinutes / 60;
  const groups = new Map<string, HistoryPoint & { irradianceTotal: number }>();
  for (const reading of readings) {
    const key = bucket(reading.observedAt, grain, timezone);
    const point = groups.get(key) ?? { bucketStart: `${key}T00:00:00.000Z`, label: labelFor(key, grain, timezone), generationWh: 0, consumptionWh: 0, importWh: 0, exportWh: 0, batteryChargeWh: 0, batteryDischargeWh: 0, averageIrradianceWm2: 0, sampleCount: 0, irradianceTotal: 0 };
    point.generationWh += reading.pvPowerW * factor;
    point.consumptionWh += reading.loadPowerW * factor;
    point.importWh += Math.max(0, reading.gridPowerW) * factor;
    point.exportWh += Math.max(0, -reading.gridPowerW) * factor;
    point.batteryChargeWh += Math.max(0, -reading.batteryPowerW) * factor;
    point.batteryDischargeWh += Math.max(0, reading.batteryPowerW) * factor;
    point.irradianceTotal += reading.irradianceWm2;
    point.sampleCount += 1;
    groups.set(key, point);
  }
  const points = [...groups.values()].sort((a, b) => a.bucketStart.localeCompare(b.bucketStart)).map(({ irradianceTotal, ...point }) => ({ ...point, generationWh: Math.round(point.generationWh), consumptionWh: Math.round(point.consumptionWh), importWh: Math.round(point.importWh), exportWh: Math.round(point.exportWh), batteryChargeWh: Math.round(point.batteryChargeWh), batteryDischargeWh: Math.round(point.batteryDischargeWh), averageIrradianceWm2: point.sampleCount ? Math.round(irradianceTotal / point.sampleCount) : 0 }));
  const summary = points.reduce((total, point) => ({ generationWh: total.generationWh + point.generationWh, consumptionWh: total.consumptionWh + point.consumptionWh, importWh: total.importWh + point.importWh, exportWh: total.exportWh + point.exportWh }), { generationWh: 0, consumptionWh: 0, importWh: 0, exportWh: 0 });
  const consumedSolarWh = Math.max(0, summary.generationWh - summary.exportWh);
  const expectedSamples = Math.max(1, Math.round((to.getTime() - from.getTime()) / (intervalMinutes * 60_000)));
  return { points, summary: { ...summary, selfConsumptionPct: summary.generationWh ? Math.round(consumedSolarWh / summary.generationWh * 1000) / 10 : 0 }, completenessPct: Math.min(100, Math.round(readings.length / expectedSamples * 10_000) / 100) };
}

export function historyToCsv(points: HistoryPoint[]) {
  const header = "date,generation_kwh,consumption_kwh,grid_import_kwh,grid_export_kwh,battery_charge_kwh,battery_discharge_kwh,average_irradiance_wm2,sample_count";
  const rows = points.map((point) => [point.bucketStart.slice(0, 10), point.generationWh / 1000, point.consumptionWh / 1000, point.importWh / 1000, point.exportWh / 1000, point.batteryChargeWh / 1000, point.batteryDischargeWh / 1000, point.averageIrradianceWm2, point.sampleCount].join(","));
  return [header, ...rows].join("\n");
}
