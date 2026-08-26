import { deriveConnectivityStatus } from "@/lib/gateway/status";
import type { AlertCandidate, AlertEvidenceQuality, AlertType } from "@/lib/alerts/types";

type ReadingQuality = "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";

export type AlertDetectionInput = {
  now: Date;
  siteId: string;
  siteMode: "SIMULATED" | "HARDWARE";
  installedCapacityW: number;
  batteryReservePct: number | null;
  gateway: {
    id: string;
    name: string;
    lastSeenAt: Date | null;
    expectedIntervalSec: number;
  } | null;
  devices: Array<{
    externalId: string;
    name: string;
    kind: "PV_ARRAY" | "INVERTER" | "BATTERY" | "GRID_METER" | "LOAD_METER" | "WEATHER_SENSOR";
    lastSeenAt: Date | null;
    expectedIntervalSec: number;
    operationalState: "UNKNOWN" | "RUNNING" | "STANDBY" | "STOPPED" | "FAULT";
  }>;
  readings: Array<{
    observedAt: Date;
    quality: ReadingQuality;
    pvPowerW: number;
    batterySocPct: number;
    gridVoltageV: number;
    irradianceWm2: number;
    deviceStatus: string;
  }>;
};

export type AlertDetectionResult = {
  candidates: AlertCandidate[];
  evaluatedTypes: AlertType[];
};

function evidenceQuality(readings: AlertDetectionInput["readings"], siteMode: AlertDetectionInput["siteMode"]): AlertEvidenceQuality {
  if (!readings.length) return siteMode === "SIMULATED" ? "SIMULATED" : "MEASURED";
  const qualities = new Set(readings.map((item) => item.quality));
  if (qualities.size === 1 && qualities.has("SIMULATED")) return "SIMULATED";
  if (qualities.size === 1 && qualities.has("MEASURED")) return "MEASURED";
  return "MIXED";
}

function sustainedTail(
  readings: AlertDetectionInput["readings"],
  predicate: (reading: AlertDetectionInput["readings"][number]) => boolean,
  expectedIntervalSec: number,
) {
  const ordered = [...readings].sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
  const tail: AlertDetectionInput["readings"] = [];
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (!predicate(ordered[index])) break;
    tail.unshift(ordered[index]);
  }
  if (tail.length < 3) return [];
  const spanSec = (tail.at(-1)!.observedAt.getTime() - tail[0].observedAt.getTime()) / 1_000;
  return spanSec >= Math.max(60, expectedIntervalSec * 2) ? tail : [];
}

export function detectAlertCandidates(input: AlertDetectionInput): AlertDetectionResult {
  if (!input.gateway) return { candidates: [], evaluatedTypes: [] };

  const gatewayStatus = deriveConnectivityStatus(
    input.gateway.lastSeenAt,
    input.gateway.expectedIntervalSec,
    input.now,
  );
  if (gatewayStatus === "OFFLINE") {
    const lastSeenAt = input.gateway.lastSeenAt?.toISOString() ?? null;
    return {
      candidates: [{
        key: `gateway:${input.gateway.id}:offline`,
        type: "GATEWAY_OFFLINE",
        severity: "CRITICAL",
        title: `${input.gateway.name} is offline`,
        summary: "No gateway data arrived within ten expected reporting intervals.",
        evidenceQuality: input.siteMode === "SIMULATED" ? "SIMULATED" : "MEASURED",
        evidence: {
          gatewayId: input.gateway.id,
          gatewayName: input.gateway.name,
          lastSeenAt,
          expectedIntervalSec: input.gateway.expectedIntervalSec,
        },
      }],
      evaluatedTypes: ["GATEWAY_OFFLINE"],
    };
  }

  const candidates: AlertCandidate[] = [];
  const evaluatedTypes: AlertType[] = [
    "GATEWAY_OFFLINE",
    "DEVICE_OFFLINE",
    "INVERTER_FAULT",
    "GRID_OUTAGE",
    "BATTERY_LOW",
    "PV_UNDERPERFORMANCE",
  ];
  const deviceEvidenceQuality = input.siteMode === "SIMULATED" ? "SIMULATED" : "MEASURED";

  for (const device of input.devices) {
    const connectivity = deriveConnectivityStatus(device.lastSeenAt, device.expectedIntervalSec, input.now);
    if (connectivity === "OFFLINE") {
      candidates.push({
        key: `device:${device.externalId}:offline`,
        type: "DEVICE_OFFLINE",
        severity: device.kind === "INVERTER" || device.kind === "GRID_METER" ? "CRITICAL" : "WARNING",
        title: `${device.name} stopped reporting`,
        summary: "No device data arrived within ten expected reporting intervals.",
        evidenceQuality: deviceEvidenceQuality,
        evidence: {
          deviceId: device.externalId,
          deviceName: device.name,
          deviceKind: device.kind,
          lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          expectedIntervalSec: device.expectedIntervalSec,
        },
      });
    }
    if (device.kind === "INVERTER" && connectivity !== "OFFLINE" && device.operationalState === "FAULT") {
      candidates.push({
        key: `device:${device.externalId}:fault`,
        type: "INVERTER_FAULT",
        severity: "CRITICAL",
        title: `${device.name} reported a fault`,
        summary: "The inverter's latest operational state is FAULT.",
        evidenceQuality: deviceEvidenceQuality,
        evidence: {
          deviceId: device.externalId,
          deviceName: device.name,
          deviceKind: device.kind,
          operationalState: device.operationalState,
        },
      });
    }
  }

  const outageReadings = sustainedTail(
    input.readings,
    (item) => item.gridVoltageV <= 10,
    input.gateway.expectedIntervalSec,
  );
  if (outageReadings.length) {
    candidates.push({
      key: "site:grid-outage",
      type: "GRID_OUTAGE",
      severity: "CRITICAL",
      title: "Grid outage detected",
      summary: "Grid voltage stayed below 10 V for the sustained evidence window.",
      evidenceQuality: evidenceQuality(outageReadings, input.siteMode),
      evidence: {
        sampleCount: outageReadings.length,
        durationSec: Math.round((outageReadings.at(-1)!.observedAt.getTime() - outageReadings[0].observedAt.getTime()) / 1_000),
        latestGridVoltageV: outageReadings.at(-1)!.gridVoltageV,
        latestDeviceStatus: outageReadings.at(-1)!.deviceStatus,
      },
    });
  }

  if (input.batteryReservePct !== null) {
    const batteryReadings = sustainedTail(
      input.readings,
      (item) => item.batterySocPct <= input.batteryReservePct!,
      input.gateway.expectedIntervalSec,
    );
    if (batteryReadings.length) {
      candidates.push({
        key: "site:battery-low",
        type: "BATTERY_LOW",
        severity: batteryReadings.at(-1)!.batterySocPct <= Math.max(5, input.batteryReservePct - 10) ? "CRITICAL" : "WARNING",
        title: "Battery below reserve",
        summary: "Battery state of charge stayed below its configured reserve.",
        evidenceQuality: evidenceQuality(batteryReadings, input.siteMode),
        evidence: {
          sampleCount: batteryReadings.length,
          batterySocPct: batteryReadings.at(-1)!.batterySocPct,
          reservePct: input.batteryReservePct,
        },
      });
    }
  }

  const hasInverterFault = candidates.some((item) => item.type === "INVERTER_FAULT");
  if (!outageReadings.length && !hasInverterFault && input.installedCapacityW > 0) {
    const underperformingReadings = sustainedTail(
      input.readings,
      (item) => {
        if (item.irradianceWm2 < 200) return false;
        const expectedPowerW = input.installedCapacityW * (item.irradianceWm2 / 1_000) * 0.8;
        return expectedPowerW > 0 && item.pvPowerW / expectedPowerW < 0.5;
      },
      input.gateway.expectedIntervalSec,
    );
    if (underperformingReadings.length) {
      const latest = underperformingReadings.at(-1)!;
      const expectedPowerW = input.installedCapacityW * (latest.irradianceWm2 / 1_000) * 0.8;
      candidates.push({
        key: "site:pv-underperformance",
        type: "PV_UNDERPERFORMANCE",
        severity: "WARNING",
        title: "Solar output is below the modeled range",
        summary: "Daylight output stayed below 50% of the transparent irradiance-based estimate.",
        evidenceQuality: evidenceQuality(underperformingReadings, input.siteMode),
        evidence: {
          sampleCount: underperformingReadings.length,
          pvPowerW: latest.pvPowerW,
          expectedPowerW: Math.round(expectedPowerW),
          irradianceWm2: latest.irradianceWm2,
          thresholdPct: 50,
        },
      });
    }
  }

  return { candidates, evaluatedTypes };
}
