import "server-only";

import { db } from "@/lib/db";
import { createPersistedTelemetrySnapshot } from "@/lib/telemetry/persisted-snapshot";
import { startOfLocalDay } from "@/lib/time/zoned";

const readingSelect = {
  observedAt: true,
  source: true,
  quality: true,
  pvPowerW: true,
  pvEnergyTodayWh: true,
  loadPowerW: true,
  gridPowerW: true,
  batteryPowerW: true,
  batterySocPct: true,
  dcVoltageV: true,
  dcCurrentA: true,
  acVoltageV: true,
  acCurrentA: true,
  gridVoltageV: true,
  frequencyHz: true,
  inverterTemperatureC: true,
  panelTemperatureC: true,
  irradianceWm2: true,
  deviceStatus: true,
  gatewayId: true,
} as const;

export async function getLatestTelemetrySnapshot(site: { id: string; name: string; timezone?: string }, now = new Date()) {
  const reading = await db.telemetryReading.findFirst({
    where: { siteId: site.id },
    orderBy: { observedAt: "desc" },
    select: readingSelect,
  });
  if (!reading) return null;

  const [recentDescending, gateway] = await Promise.all([
    db.telemetryReading.findMany({
      where: {
        siteId: site.id,
        observedAt: {
          gte: startOfLocalDay(now, site.timezone ?? "Asia/Colombo"),
          lte: reading.observedAt,
        },
      },
      orderBy: { observedAt: "asc" },
      select: { observedAt: true, pvPowerW: true, loadPowerW: true },
    }),
    db.edgeGateway.findFirst({
      where: reading.gatewayId ? { id: reading.gatewayId } : { siteId: site.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        lastSeenAt: true,
        expectedIntervalSec: true,
        devices: {
          orderBy: [{ kind: "asc" }, { name: "asc" }],
          select: {
            externalId: true,
            name: true,
            kind: true,
            connectivityStatus: true,
            operationalState: true,
            lastSeenAt: true,
            expectedIntervalSec: true,
            metrics: true,
          },
        },
      },
    }),
  ]);

  return createPersistedTelemetrySnapshot({
    site,
    reading,
    recentReadings: recentDescending,
    gateway,
    now,
  });
}
