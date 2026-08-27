import { deriveConnectivityStatus, type ConnectivityStatus } from "@/lib/gateway/status";
import type { EquipmentOperationalState, TelemetryDeviceStatus, TelemetrySnapshot } from "@/lib/telemetry/types";

type PersistedReading = {
  observedAt: Date;
  source: "SIMULATOR" | "HARDWARE";
  quality: "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";
  pvPowerW: number;
  pvEnergyTodayWh: number;
  loadPowerW: number;
  gridPowerW: number;
  batteryPowerW: number;
  batterySocPct: number;
  dcVoltageV: number;
  dcCurrentA: number;
  acVoltageV: number;
  acCurrentA: number;
  gridVoltageV: number;
  frequencyHz: number;
  inverterTemperatureC: number;
  panelTemperatureC: number;
  irradianceWm2: number;
  deviceStatus: string;
};

type PersistedDevice = {
  externalId: string;
  name: string;
  kind: string;
  connectivityStatus: ConnectivityStatus;
  operationalState: EquipmentOperationalState;
  lastSeenAt: Date | null;
  expectedIntervalSec: number;
  metrics: unknown;
};

type PersistedGateway = {
  id: string;
  name: string;
  lastSeenAt: Date | null;
  expectedIntervalSec: number;
  devices: PersistedDevice[];
};

const statusRank: Record<ConnectivityStatus, number> = { NEVER_SEEN: 0, ONLINE: 1, STALE: 2, OFFLINE: 3 };

function leastHealthy(first: ConnectivityStatus, second: ConnectivityStatus) {
  return statusRank[first] >= statusRank[second] ? first : second;
}

function numericMetric(metrics: unknown, key: string) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return 0;
  const value = (metrics as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function arrayStatus(device: PersistedDevice, connectivity: ConnectivityStatus) {
  if (connectivity === "OFFLINE" || connectivity === "NEVER_SEEN") return "OFFLINE" as const;
  if (connectivity === "STALE" || device.operationalState === "FAULT" || device.operationalState === "STOPPED") return "UNDERPERFORMING" as const;
  return "NORMAL" as const;
}

const knownDeviceStatuses = new Set<TelemetryDeviceStatus>([
  "NORMAL", "CLOUD_RAMP", "ARRAY_UNDERPERFORMING", "GRID_OUTAGE", "INVERTER_FAULT", "BATTERY_FAULT",
]);

const displayBucketMs = 5 * 60_000;

function aggregatePowerSeries(
  readings: Array<Pick<PersistedReading, "observedAt" | "pvPowerW" | "loadPowerW">>,
) {
  const buckets = new Map<number, { pvPowerW: number; loadPowerW: number; count: number }>();
  for (const reading of [...readings].sort((first, second) => first.observedAt.getTime() - second.observedAt.getTime())) {
    const bucketAt = Math.floor(reading.observedAt.getTime() / displayBucketMs) * displayBucketMs;
    const bucket = buckets.get(bucketAt) ?? { pvPowerW: 0, loadPowerW: 0, count: 0 };
    bucket.pvPowerW += reading.pvPowerW;
    bucket.loadPowerW += reading.loadPowerW;
    bucket.count += 1;
    buckets.set(bucketAt, bucket);
  }

  let previousBucketAt: number | null = null;
  return [...buckets.entries()].map(([bucketAt, bucket]) => {
    const gapBefore = previousBucketAt != null && bucketAt - previousBucketAt > displayBucketMs * 1.5;
    previousBucketAt = bucketAt;
    return {
      observedAt: new Date(bucketAt).toISOString(),
      pvPowerW: Math.round(bucket.pvPowerW / bucket.count),
      loadPowerW: Math.round(bucket.loadPowerW / bucket.count),
      gapBefore,
    };
  });
}

export function createPersistedTelemetrySnapshot(input: {
  site: { id: string; name: string };
  reading: PersistedReading;
  recentReadings: Array<Pick<PersistedReading, "observedAt" | "pvPowerW" | "loadPowerW">>;
  gateway: PersistedGateway | null;
  now?: Date;
}): TelemetrySnapshot {
  const now = input.now ?? new Date();
  const gatewayStatus = input.gateway
    ? deriveConnectivityStatus(input.gateway.lastSeenAt, input.gateway.expectedIntervalSec, now)
    : "NEVER_SEEN";
  const telemetryStatus = deriveConnectivityStatus(
    input.reading.observedAt,
    input.gateway?.expectedIntervalSec ?? 30,
    now,
  );
  const telemetryIsFresh = gatewayStatus === "ONLINE" && telemetryStatus === "ONLINE";
  const deviceStatus = knownDeviceStatuses.has(input.reading.deviceStatus as TelemetryDeviceStatus)
    ? input.reading.deviceStatus as TelemetryDeviceStatus
    : "NORMAL";
  const devices = input.gateway?.devices.map((device) => {
    const freshness = deriveConnectivityStatus(device.lastSeenAt, device.expectedIntervalSec, now);
    const status = leastHealthy(device.connectivityStatus, freshness);
    return {
      externalId: device.externalId,
      name: device.name,
      kind: device.kind,
      status,
      operationalState: device.operationalState,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    };
  }) ?? [];
  const arrays = (input.gateway?.devices ?? [])
    .filter((device) => device.kind === "PV_ARRAY")
    .map((device) => {
      const freshness = deriveConnectivityStatus(device.lastSeenAt, device.expectedIntervalSec, now);
      const connectivity = leastHealthy(device.connectivityStatus, freshness);
      return {
        id: device.externalId,
        name: device.name,
        powerW: numericMetric(device.metrics, "powerW"),
        status: arrayStatus(device, connectivity),
      };
    });

  return {
    siteId: input.site.id,
    siteName: input.site.name,
    source: input.reading.source,
    quality: telemetryIsFresh ? input.reading.quality : "STALE",
    observedAt: input.reading.observedAt.toISOString(),
    scenario: telemetryIsFresh
      ? { code: "NORMAL", label: "Gateway telemetry", message: "This reading was received and stored from the connected site gateway." }
      : { code: "NORMAL", label: "Last known telemetry", message: "No fresh gateway packet has arrived. Values are preserved from the last stored reading." },
    deviceStatus,
    pvPowerW: input.reading.pvPowerW,
    pvEnergyTodayWh: input.reading.pvEnergyTodayWh,
    loadPowerW: input.reading.loadPowerW,
    gridPowerW: input.reading.gridPowerW,
    batteryPowerW: input.reading.batteryPowerW,
    batterySocPct: input.reading.batterySocPct,
    dcVoltageV: input.reading.dcVoltageV,
    dcCurrentA: input.reading.dcCurrentA,
    acVoltageV: input.reading.acVoltageV,
    acCurrentA: input.reading.acCurrentA,
    gridVoltageV: input.reading.gridVoltageV,
    frequencyHz: input.reading.frequencyHz,
    inverterTemperatureC: input.reading.inverterTemperatureC,
    panelTemperatureC: input.reading.panelTemperatureC,
    irradianceWm2: input.reading.irradianceWm2,
    arrays,
    series: aggregatePowerSeries(input.recentReadings),
    connectivity: {
      gateway: {
        id: input.gateway?.id ?? null,
        name: input.gateway?.name ?? "No gateway enrolled",
        status: gatewayStatus,
        lastSeenAt: input.gateway?.lastSeenAt?.toISOString() ?? null,
        expectedIntervalSec: input.gateway?.expectedIntervalSec ?? 30,
      },
      devices,
    },
  };
}
