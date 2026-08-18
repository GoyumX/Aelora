import type { EquipmentConnectivityStatus, TelemetrySnapshot } from "@/lib/telemetry/types";

export type DashboardSite = {
  id: string;
  name: string;
  mode: "SIMULATED" | "HARDWARE";
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  timezone?: string;
  installedCapacityW?: number;
};

export type DashboardSnapshot = {
  site: Omit<DashboardSite, "timezone">;
  observedAt: string;
  sourceLabel: string;
  connectivityStatus: EquipmentConnectivityStatus;
  metrics: {
    pvPowerKw: number;
    energyTodayKwh: number;
    loadPowerKw: number;
    batteryPowerKw: number;
    batterySocPct: number;
    gridPowerKw: number;
    weather: {
      condition: string;
      temperatureC: number;
      irradianceWm2: number;
    };
  };
  intraday: Array<{ label: string; generationKw: number; consumptionKw: number }>;
  forecast: Array<{
    label: string;
    condition: string;
    predictedEnergyKwh: number;
    confidencePct: number;
  }>;
  alert: {
    severity: "INFO" | "WARNING" | "CRITICAL";
    title: string;
    detail: string;
  };
  recommendation: string;
};

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function localHour(date: Date, timezone: string) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;

  return Number(hour ?? 12) % 24;
}

function generationAt(hour: number, cloudFactor: number, capacityKw: number) {
  if (hour < 6 || hour > 18) return 0;
  return round(Math.sin(((hour - 6) / 12) * Math.PI) * capacityKw * cloudFactor);
}

function consumptionAt(hour: number) {
  const morningPeak = hour >= 6 && hour <= 9 ? 0.72 : 0;
  const eveningPeak = hour >= 18 && hour <= 22 ? 1.08 : 0;
  const daytime = hour >= 10 && hour <= 16 ? 0.32 : 0;
  return round(0.92 + morningPeak + eveningPeak + daytime);
}

export function createDashboardSnapshot(site: DashboardSite, observedAt = new Date()): DashboardSnapshot {
  const timezone = site.timezone ?? "Asia/Colombo";
  const hour = localHour(observedAt, timezone);
  const daySeed = observedAt.getUTCDate() + site.id.length;
  const cloudFactor = round(0.8 + (daySeed % 5) * 0.035, 3);
  const capacityKw = (site.installedCapacityW ?? 5650) / 1000;
  const pvPowerKw = generationAt(hour, cloudFactor, capacityKw);
  const loadPowerKw = consumptionAt(hour);
  const batterySocPct = Math.min(100, Math.max(10, 64 + ((daySeed * 7 + hour * 3) % 25)));
  const rawSurplus = pvPowerKw - loadPowerKw;
  const batteryPowerKw = rawSurplus > 0
    ? -Math.min(rawSurplus, batterySocPct >= 95 ? 0 : 1.2)
    : Math.min(Math.abs(rawSurplus), batterySocPct <= 20 ? 0 : 0.9);
  const gridPowerKw = round(loadPowerKw - pvPowerKw - batteryPowerKw);
  const intraday = Array.from({ length: 13 }, (_, index) => {
    const pointHour = index + 6;
    return {
      label: `${String(pointHour).padStart(2, "0")}:00`,
      generationKw: generationAt(pointHour, cloudFactor, capacityKw),
      consumptionKw: consumptionAt(pointHour),
    };
  });
  const elapsedDaylight = intraday.filter((_, index) => index + 6 <= hour);
  const energyTodayKwh = round(elapsedDaylight.reduce((sum, point) => sum + point.generationKw, 0));

  return {
    site: { id: site.id, name: site.name, mode: site.mode, status: site.status },
    observedAt: observedAt.toISOString(),
    sourceLabel: site.mode === "SIMULATED" ? "Deterministic digital twin" : "Connected hardware adapter",
    connectivityStatus: "NEVER_SEEN",
    metrics: {
      pvPowerKw,
      energyTodayKwh,
      loadPowerKw,
      batteryPowerKw: round(batteryPowerKw),
      batterySocPct,
      gridPowerKw,
      weather: {
        condition: cloudFactor < 0.86 ? "Partly cloudy" : "Mostly sunny",
        temperatureC: 28 + (daySeed % 4),
        irradianceWm2: Math.round(Math.max(0, pvPowerKw / capacityKw) * 890),
      },
    },
    intraday,
    forecast: [
      { label: "Tomorrow", condition: "Mostly sunny", predictedEnergyKwh: round(25.4 * cloudFactor, 1), confidencePct: 88 },
      { label: "Day after", condition: "Cloud intervals", predictedEnergyKwh: round(22.1 * cloudFactor, 1), confidencePct: 81 },
    ],
    alert: site.status === "ACTIVE"
      ? {
          severity: "INFO",
          title: "No active system faults",
          detail: "The simulated inverter, battery, and grid connection are operating normally.",
        }
      : {
          severity: "WARNING",
          title: "Site is not in active operation",
          detail: "Review site status and configuration before relying on monitoring values.",
        },
    recommendation: gridPowerKw < 0
      ? "Use flexible appliances now while the system has a solar surplus."
      : "Schedule flexible appliances between 11:00 and 14:00 when solar generation is expected to peak.",
  };
}

export function createDashboardSnapshotFromTelemetry(site: DashboardSite, telemetry: TelemetrySnapshot): DashboardSnapshot {
  const gatewayStatus = telemetry.connectivity.gateway.status;
  const intraday = telemetry.series.map((point) => ({
    label: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: site.timezone ?? "Asia/Colombo",
    }).format(new Date(point.observedAt)),
    generationKw: round(point.pvPowerW / 1000),
    consumptionKw: round(point.loadPowerW / 1000),
  }));
  return {
    site: { id: site.id, name: site.name, mode: site.mode, status: site.status },
    observedAt: telemetry.observedAt,
    sourceLabel: telemetry.source === "SIMULATOR" ? "Virtual gateway telemetry" : "Hardware gateway telemetry",
    connectivityStatus: gatewayStatus,
    metrics: {
      pvPowerKw: round(telemetry.pvPowerW / 1000),
      energyTodayKwh: round(telemetry.pvEnergyTodayWh / 1000),
      loadPowerKw: round(telemetry.loadPowerW / 1000),
      batteryPowerKw: round(telemetry.batteryPowerW / 1000),
      batterySocPct: telemetry.batterySocPct,
      gridPowerKw: round(telemetry.gridPowerW / 1000),
      weather: {
        condition: telemetry.irradianceWm2 >= 650 ? "Strong sunlight" : telemetry.irradianceWm2 >= 150 ? "Reduced sunlight" : "Low irradiance",
        temperatureC: telemetry.panelTemperatureC,
        irradianceWm2: telemetry.irradianceWm2,
      },
    },
    intraday,
    forecast: [],
    alert: gatewayStatus === "ONLINE"
      ? { severity: "INFO", title: "Gateway is reporting", detail: "Aelora is receiving and persisting current site telemetry." }
      : { severity: "WARNING", title: `Gateway is ${gatewayStatus.toLowerCase().replaceAll("_", " ")}`, detail: "Dashboard values are the last stored reading and will not change until a new batch arrives." },
    recommendation: gatewayStatus === "ONLINE"
      ? "Review Live Monitoring for per-device connectivity and operating state."
      : "Start the site gateway and confirm publishing is enabled before relying on current values.",
  };
}
