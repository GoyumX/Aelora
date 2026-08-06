import type { TelemetryScenarioCode, TelemetrySnapshot } from "@/lib/telemetry/types";

type SimulatorSite = {
  id: string;
  name: string;
  timezone: string;
  mode: "SIMULATED" | "HARDWARE";
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
};

const scenarioCopy: Record<TelemetryScenarioCode, TelemetrySnapshot["scenario"]> = {
  NORMAL: { code: "NORMAL", label: "Normal operation", message: "Deterministic normal-day simulation is active." },
  SUDDEN_CLOUD: { code: "SUDDEN_CLOUD", label: "Sudden cloud ramp", message: "Cloud cover is temporarily reducing simulated solar output." },
  PARTIAL_SHADING: { code: "PARTIAL_SHADING", label: "Partial shading", message: "The east array is underperforming in this simulated scenario." },
  GRID_OUTAGE: { code: "GRID_OUTAGE", label: "Grid outage", message: "A simulated grid outage is active; grid voltage and power flow are zero." },
  INVERTER_FAULT: { code: "INVERTER_FAULT", label: "Inverter fault", message: "The simulated inverter is offline and producing no AC solar power." },
  BATTERY_FAULT: { code: "BATTERY_FAULT", label: "Battery unavailable", message: "The simulated battery is isolated and cannot charge or discharge." },
};

function round(value: number, places = 0) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function localTime(date: Date, timezone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return (Number(values.hour) % 24) + Number(values.minute) / 60;
}

function basePoint(site: SimulatorSite, date: Date, scenario: TelemetryScenarioCode) {
  const hour = localTime(date, site.timezone);
  const daylight = hour < 5.75 || hour > 18.4 ? 0 : Math.sin(((hour - 5.75) / 12.65) * Math.PI);
  const seed = site.id.length + date.getUTCDate();
  const weatherFactor = 0.84 + (seed % 5) * 0.025;
  const scenarioFactor = scenario === "SUDDEN_CLOUD" ? 0.38 : scenario === "PARTIAL_SHADING" ? 0.74 : 1;
  let pvPowerW = round(Math.max(0, daylight * 5650 * weatherFactor * scenarioFactor));
  const morningPeak = hour >= 6 && hour <= 9 ? 700 : 0;
  const eveningPeak = hour >= 18 && hour <= 22 ? 1050 : 0;
  const loadPowerW = round(920 + morningPeak + eveningPeak + (hour >= 10 && hour <= 16 ? 320 : 0));
  const batterySocPct = Math.min(98, Math.max(12, 62 + ((seed * 7 + Math.floor(hour) * 3) % 28)));
  let batteryPowerW = pvPowerW > loadPowerW
    ? -Math.min(pvPowerW - loadPowerW, batterySocPct > 94 ? 0 : 1200)
    : Math.min(loadPowerW - pvPowerW, batterySocPct < 20 ? 0 : 900);
  let gridPowerW = loadPowerW - pvPowerW - batteryPowerW;

  if (scenario === "INVERTER_FAULT") {
    pvPowerW = 0;
    batteryPowerW = batterySocPct > 20 ? Math.min(loadPowerW, 900) : 0;
    gridPowerW = loadPowerW - batteryPowerW;
  }
  if (scenario === "BATTERY_FAULT") {
    batteryPowerW = 0;
    gridPowerW = loadPowerW - pvPowerW;
  }
  if (scenario === "GRID_OUTAGE") {
    gridPowerW = 0;
    batteryPowerW = loadPowerW - pvPowerW;
  }

  return { hour, pvPowerW, loadPowerW, batteryPowerW: round(batteryPowerW), gridPowerW: round(gridPowerW), batterySocPct, daylight };
}

export function createTelemetrySnapshot(site: SimulatorSite, observedAt = new Date(), scenario: TelemetryScenarioCode = "NORMAL"): TelemetrySnapshot {
  const point = basePoint(site, observedAt, scenario);
  const dcVoltageV = point.pvPowerW > 0 ? round(355 + point.daylight * 24, 1) : 0;
  const acVoltageV = scenario === "INVERTER_FAULT" ? 0 : round(229 + ((site.id.length + observedAt.getUTCMinutes()) % 5) * 0.6, 1);
  const eastShare = scenario === "PARTIAL_SHADING" ? 0.21 : 0.46;
  const eastPowerW = round(point.pvPowerW * eastShare);
  const westPowerW = point.pvPowerW - eastPowerW;
  const elapsedHours = Math.max(0, Math.min(12.65, point.hour - 5.75));
  const series = Array.from({ length: 13 }, (_, index) => {
    const sampleTime = new Date(observedAt.getTime() - (12 - index) * 5 * 60_000);
    const sample = basePoint(site, sampleTime, scenario);
    return { observedAt: sampleTime.toISOString(), pvPowerW: sample.pvPowerW, loadPowerW: sample.loadPowerW };
  });

  return {
    siteId: site.id,
    siteName: site.name,
    source: site.mode === "HARDWARE" ? "HARDWARE" : "SIMULATOR",
    quality: site.mode === "HARDWARE" ? "MEASURED" : "SIMULATED",
    observedAt: observedAt.toISOString(),
    scenario: scenarioCopy[scenario],
    deviceStatus: scenario === "NORMAL" ? "NORMAL" : scenario === "SUDDEN_CLOUD" ? "CLOUD_RAMP" : scenario === "PARTIAL_SHADING" ? "ARRAY_UNDERPERFORMING" : scenario,
    pvPowerW: point.pvPowerW,
    pvEnergyTodayWh: round(elapsedHours * 2100 * (0.84 + ((site.id.length + observedAt.getUTCDate()) % 5) * 0.025)),
    loadPowerW: point.loadPowerW,
    gridPowerW: point.gridPowerW,
    batteryPowerW: point.batteryPowerW,
    batterySocPct: point.batterySocPct,
    dcVoltageV,
    dcCurrentA: dcVoltageV ? round(point.pvPowerW / dcVoltageV, 1) : 0,
    acVoltageV,
    acCurrentA: acVoltageV ? round(point.pvPowerW / acVoltageV, 1) : 0,
    gridVoltageV: scenario === "GRID_OUTAGE" ? 0 : round(229.4 + ((site.id.length + observedAt.getUTCMinutes()) % 5) * 0.4, 1),
    frequencyHz: scenario === "GRID_OUTAGE" ? 0 : round(49.98 + (observedAt.getUTCMinutes() % 4) * 0.01, 2),
    inverterTemperatureC: scenario === "INVERTER_FAULT" ? 36 : round(34 + point.daylight * 12, 1),
    panelTemperatureC: round(30 + point.daylight * 20, 1),
    irradianceWm2: round(point.daylight * 890),
    arrays: [
      { id: "east", name: "East array", powerW: eastPowerW, status: scenario === "INVERTER_FAULT" ? "OFFLINE" : scenario === "PARTIAL_SHADING" ? "UNDERPERFORMING" : "NORMAL" },
      { id: "west", name: "West array", powerW: westPowerW, status: scenario === "INVERTER_FAULT" ? "OFFLINE" : "NORMAL" },
    ],
    series,
  };
}
