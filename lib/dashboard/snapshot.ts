import type { EquipmentConnectivityStatus, TelemetrySnapshot } from "@/lib/telemetry/types";
import { WEATHER_REFRESH_INTERVAL_MS } from "@/lib/refresh/freshness";
import { startOfLocalDay } from "@/lib/time/zoned";

export type DashboardHourlyWeather = {
  validAt: string;
  condition: string;
  temperatureC: number | null;
  precipitationProbabilityPct: number | null;
  windSpeedKmh: number | null;
  irradianceWm2: number | null;
};

export type DashboardDailyWeather = {
  dateKey: string;
  label: string;
  condition: string;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationProbabilityPct: number | null;
};

export type DashboardSite = {
  id: string;
  name: string;
  mode: "SIMULATED" | "HARDWARE";
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  timezone?: string;
  latitude?: number;
  longitude?: number;
  installedCapacityW?: number;
};

export type DashboardSnapshot = {
  site: DashboardSite & { timezone: string };
  observedAt: string;
  dayWindow: { startAt: string; endAt: string };
  forecastUpdatedAt?: string | null;
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
      temperatureLabel: "Air temperature" | "Panel temperature";
      irradianceLabel: "Tilted irradiance" | "Global irradiance" | "Gateway irradiance";
      source: "OPEN_METEO" | "GATEWAY";
      sourceLabel: string;
      freshness: "FRESH" | "STALE" | "GATEWAY_FALLBACK";
      observedAt: string;
      fetchedAt: string;
      cloudCoverPct?: number | null;
      precipitationMm?: number | null;
      relativeHumidityPct?: number | null;
      windSpeedKmh?: number | null;
      hourly: DashboardHourlyWeather[];
      daily: DashboardDailyWeather[];
    };
  };
  intraday: Array<{ observedAt: string; label: string; generationKw: number; consumptionKw: number; gapBefore?: boolean }>;
  forecast: Array<{
    label: string;
    predictedEnergyKwh: number;
  }>;
  alert: {
    severity: "INFO" | "WARNING" | "CRITICAL";
    title: string;
    detail: string;
  };
  recommendation: string;
};

export type DashboardWeatherContext = {
  condition: string;
  temperatureAirC: number;
  shortwaveRadiationWm2?: number | null;
  globalTiltedIrradianceWm2?: number | null;
  observedAt: Date | string;
  fetchedAt: Date | string;
  providerLabel: string;
  cloudCoverPct?: number | null;
  precipitationMm?: number | null;
  relativeHumidityPct?: number | null;
  windSpeedKmh?: number | null;
  forecastPoints?: DashboardHourlyWeather[];
} | null;

export type DashboardForecastContext = Array<{
  label: string;
  predictedEnergyKwh: number;
}>;

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

function weatherOutlook(
  points: DashboardHourlyWeather[] | undefined,
  timezone: string,
  now: Date,
) {
  const future = (points ?? []).filter((point) => new Date(point.validAt) >= now);
  const hourly = future.slice(0, 12);
  const dailyGroups = new Map<string, DashboardDailyWeather>();
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const weekdayFormatter = new Intl.DateTimeFormat("en", { timeZone: timezone, weekday: "short" });

  for (const point of future) {
    const date = new Date(point.validAt);
    const dateKey = dateFormatter.format(date);
    const current = dailyGroups.get(dateKey) ?? {
      dateKey,
      label: weekdayFormatter.format(date),
      condition: point.condition,
      temperatureMinC: point.temperatureC,
      temperatureMaxC: point.temperatureC,
      precipitationProbabilityPct: point.precipitationProbabilityPct,
    };
    if (point.temperatureC != null) {
      current.temperatureMinC = current.temperatureMinC == null ? point.temperatureC : Math.min(current.temperatureMinC, point.temperatureC);
      current.temperatureMaxC = current.temperatureMaxC == null ? point.temperatureC : Math.max(current.temperatureMaxC, point.temperatureC);
    }
    if ((point.precipitationProbabilityPct ?? -1) > (current.precipitationProbabilityPct ?? -1)) {
      current.precipitationProbabilityPct = point.precipitationProbabilityPct;
      current.condition = point.condition;
    }
    dailyGroups.set(dateKey, current);
  }

  return { hourly, daily: [...dailyGroups.values()].slice(0, 7) };
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
      observedAt: new Date(observedAt.getTime() + (pointHour - hour) * 3_600_000).toISOString(),
      label: `${String(pointHour).padStart(2, "0")}:00`,
      generationKw: generationAt(pointHour, cloudFactor, capacityKw),
      consumptionKw: consumptionAt(pointHour),
    };
  });
  const elapsedDaylight = intraday.filter((_, index) => index + 6 <= hour);
  const energyTodayKwh = round(elapsedDaylight.reduce((sum, point) => sum + point.generationKw, 0));

  return {
    site: { ...site, timezone },
    observedAt: observedAt.toISOString(),
    dayWindow: { startAt: startOfLocalDay(observedAt, timezone).toISOString(), endAt: observedAt.toISOString() },
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
        temperatureLabel: "Panel temperature",
        irradianceLabel: "Gateway irradiance",
        source: "GATEWAY",
        sourceLabel: "Deterministic digital twin",
        freshness: "GATEWAY_FALLBACK",
        observedAt: observedAt.toISOString(),
        fetchedAt: observedAt.toISOString(),
        hourly: [],
        daily: [],
      },
    },
    intraday,
    forecast: [
      { label: "Tomorrow", predictedEnergyKwh: round(25.4 * cloudFactor, 1) },
      { label: "Day after", predictedEnergyKwh: round(22.1 * cloudFactor, 1) },
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

export function createDashboardSnapshotFromTelemetry(
  site: DashboardSite,
  telemetry: TelemetrySnapshot,
  weather: DashboardWeatherContext = null,
  now = new Date(),
  forecast: DashboardForecastContext = [],
  forecastUpdatedAt: Date | string | null = null,
): DashboardSnapshot {
  const gatewayStatus = telemetry.connectivity.gateway.status;
  const weatherIrradiance = weather?.globalTiltedIrradianceWm2 ?? weather?.shortwaveRadiationWm2;
  const weatherAgeMs = weather ? now.getTime() - new Date(weather.fetchedAt).getTime() : null;
  const weatherFreshness = weatherAgeMs != null && weatherAgeMs <= WEATHER_REFRESH_INTERVAL_MS
    ? "FRESH" as const
    : weather ? "STALE" as const : "GATEWAY_FALLBACK" as const;
  const intraday = telemetry.series.map((point) => ({
    observedAt: new Date(point.observedAt).toISOString(),
    label: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: site.timezone ?? "Asia/Colombo",
    }).format(new Date(point.observedAt)),
    generationKw: round(point.pvPowerW / 1000),
    consumptionKw: round(point.loadPowerW / 1000),
    gapBefore: point.gapBefore,
  }));
  const outlook = weatherOutlook(weather?.forecastPoints, site.timezone ?? "Asia/Colombo", now);
  return {
    site: { ...site, timezone: site.timezone ?? "Asia/Colombo" },
    observedAt: telemetry.observedAt,
    dayWindow: {
      startAt: startOfLocalDay(now, site.timezone ?? "Asia/Colombo").toISOString(),
      endAt: now.toISOString(),
    },
    forecastUpdatedAt: forecastUpdatedAt ? new Date(forecastUpdatedAt).toISOString() : null,
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
        condition: weather?.condition ?? (telemetry.irradianceWm2 >= 650 ? "Strong sunlight" : telemetry.irradianceWm2 >= 150 ? "Reduced sunlight" : "Low irradiance"),
        temperatureC: round(weather?.temperatureAirC ?? telemetry.panelTemperatureC, 1),
        irradianceWm2: Math.round(weatherIrradiance ?? telemetry.irradianceWm2),
        temperatureLabel: weather ? "Air temperature" : "Panel temperature",
        irradianceLabel: weather?.globalTiltedIrradianceWm2 != null
          ? "Tilted irradiance"
          : weather ? "Global irradiance" : "Gateway irradiance",
        source: weather ? "OPEN_METEO" : "GATEWAY",
        sourceLabel: weather?.providerLabel ?? "Site gateway sensor",
        freshness: weatherFreshness,
        observedAt: new Date(weather?.observedAt ?? telemetry.observedAt).toISOString(),
        fetchedAt: new Date(weather?.fetchedAt ?? telemetry.observedAt).toISOString(),
        cloudCoverPct: weather?.cloudCoverPct,
        precipitationMm: weather?.precipitationMm,
        relativeHumidityPct: weather?.relativeHumidityPct,
        windSpeedKmh: weather?.windSpeedKmh,
        hourly: outlook.hourly,
        daily: outlook.daily,
      },
    },
    intraday,
    forecast,
    alert: gatewayStatus === "ONLINE"
      ? { severity: "INFO", title: "Gateway is reporting", detail: "Aelora is receiving and persisting current site telemetry." }
      : { severity: "WARNING", title: `Gateway is ${gatewayStatus.toLowerCase().replaceAll("_", " ")}`, detail: "Dashboard values are the last stored reading and will not change until a new batch arrives." },
    recommendation: gatewayStatus === "ONLINE"
      ? "Review Live Monitoring for per-device connectivity and operating state."
      : "Start the site gateway and confirm publishing is enabled before relying on current values.",
  };
}

export function summarizeDashboardForecast(
  points: Array<{ validAt: string; estimatedEnergyKwh: number; leadHours: number }>,
  timezone: string,
  now = new Date(),
): DashboardForecastContext {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const groups = new Map<string, number>();
  const horizonEnd = now.getTime() + 48 * 60 * 60 * 1000;
  for (const point of points.filter((entry) => {
    const validAt = new Date(entry.validAt).getTime();
    return validAt > now.getTime() && validAt <= horizonEnd;
  })) {
    const label = formatter.format(new Date(point.validAt));
    groups.set(label, (groups.get(label) ?? 0) + point.estimatedEnergyKwh);
  }
  return [...groups].slice(0, 2).map(([label, predictedEnergyKwh]) => ({
    label,
    predictedEnergyKwh: round(predictedEnergyKwh, 1),
  }));
}
