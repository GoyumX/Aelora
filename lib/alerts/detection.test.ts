import { describe, expect, it } from "vitest";

import { detectAlertCandidates, type AlertDetectionInput } from "@/lib/alerts/detection";

const now = new Date("2026-08-21T08:00:00.000Z");

function reading(
  secondsAgo: number,
  overrides: Partial<AlertDetectionInput["readings"][number]> = {},
): AlertDetectionInput["readings"][number] {
  return {
    observedAt: new Date(now.getTime() - secondsAgo * 1_000),
    quality: "SIMULATED",
    pvPowerW: 3_400,
    batterySocPct: 68,
    gridVoltageV: 230,
    irradianceWm2: 720,
    deviceStatus: "RUNNING",
    ...overrides,
  };
}

function input(overrides: Partial<AlertDetectionInput> = {}): AlertDetectionInput {
  return {
    now,
    siteId: "site-1",
    siteMode: "SIMULATED",
    installedCapacityW: 6_000,
    batteryReservePct: 20,
    gateway: {
      id: "gateway-1",
      name: "Virtual site gateway",
      lastSeenAt: new Date(now.getTime() - 10_000),
      expectedIntervalSec: 30,
    },
    devices: [],
    readings: [reading(60), reading(30), reading(0)],
    ...overrides,
  };
}

describe("alert detection", () => {
  it("waits for an enrolled gateway before treating stored telemetry as current alert evidence", () => {
    expect(detectAlertCandidates(input({ gateway: null }))).toEqual({ candidates: [], evaluatedTypes: [] });
  });

  it("requires sustained low grid voltage and never treats zero solar output as a power cut", () => {
    const twoLowVoltageSamples = detectAlertCandidates(input({
      readings: [reading(30, { gridVoltageV: 0 }), reading(0, { gridVoltageV: 0 })],
    }));
    const zeroPvOnly = detectAlertCandidates(input({
      readings: [reading(60, { pvPowerW: 0 }), reading(30, { pvPowerW: 0 }), reading(0, { pvPowerW: 0 })],
    }));
    const sustainedOutage = detectAlertCandidates(input({
      readings: [
        reading(60, { gridVoltageV: 0, deviceStatus: "GRID_OUTAGE" }),
        reading(30, { gridVoltageV: 0, deviceStatus: "GRID_OUTAGE" }),
        reading(0, { gridVoltageV: 0, deviceStatus: "GRID_OUTAGE" }),
      ],
    }));

    expect(twoLowVoltageSamples.candidates).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "GRID_OUTAGE" })]));
    expect(zeroPvOnly.candidates).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "GRID_OUTAGE" })]));
    expect(sustainedOutage.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "GRID_OUTAGE", severity: "CRITICAL", evidenceQuality: "SIMULATED" }),
    ]));
  });

  it("raises one gateway incident and suppresses stale downstream evidence while it is offline", () => {
    const result = detectAlertCandidates(input({
      gateway: {
        id: "gateway-1",
        name: "Roof gateway",
        lastSeenAt: new Date(now.getTime() - 301_000),
        expectedIntervalSec: 30,
      },
      devices: [{
        externalId: "inv-1",
        name: "Main inverter",
        kind: "INVERTER",
        lastSeenAt: new Date(now.getTime() - 301_000),
        expectedIntervalSec: 30,
        operationalState: "FAULT",
      }],
    }));

    expect(result.candidates).toEqual([
      expect.objectContaining({ key: "gateway:gateway-1:offline", type: "GATEWAY_OFFLINE", severity: "CRITICAL" }),
    ]);
    expect(result.evaluatedTypes).toEqual(["GATEWAY_OFFLINE"]);
  });

  it("detects inverter faults and separately identifies devices that stopped reporting", () => {
    const result = detectAlertCandidates(input({
      devices: [
        {
          externalId: "inv-1",
          name: "Main inverter",
          kind: "INVERTER",
          lastSeenAt: new Date(now.getTime() - 10_000),
          expectedIntervalSec: 30,
          operationalState: "FAULT",
        },
        {
          externalId: "battery-1",
          name: "Battery pack",
          kind: "BATTERY",
          lastSeenAt: new Date(now.getTime() - 301_000),
          expectedIntervalSec: 30,
          operationalState: "RUNNING",
        },
      ],
    }));

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "device:inv-1:fault", type: "INVERTER_FAULT" }),
      expect.objectContaining({ key: "device:battery-1:offline", type: "DEVICE_OFFLINE" }),
    ]));
  });

  it("requires three daylight samples before flagging PV underperformance", () => {
    const result = detectAlertCandidates(input({
      readings: [
        reading(60, { pvPowerW: 500, irradianceWm2: 800 }),
        reading(30, { pvPowerW: 450, irradianceWm2: 780 }),
        reading(0, { pvPowerW: 480, irradianceWm2: 790 }),
      ],
    }));
    const atNight = detectAlertCandidates(input({
      readings: [
        reading(60, { pvPowerW: 0, irradianceWm2: 0 }),
        reading(30, { pvPowerW: 0, irradianceWm2: 0 }),
        reading(0, { pvPowerW: 0, irradianceWm2: 0 }),
      ],
    }));

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "PV_UNDERPERFORMANCE", severity: "WARNING" }),
    ]));
    expect(atNight.candidates).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "PV_UNDERPERFORMANCE" })]));
  });

  it("uses the configured battery reserve and labels mixed telemetry evidence", () => {
    const result = detectAlertCandidates(input({
      readings: [
        reading(60, { batterySocPct: 18, quality: "MEASURED" }),
        reading(30, { batterySocPct: 17, quality: "SIMULATED" }),
        reading(0, { batterySocPct: 16, quality: "MEASURED" }),
      ],
    }));

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "BATTERY_LOW", evidenceQuality: "MIXED" }),
    ]));
  });

  it("marks a deeply depleted measured battery as critical", () => {
    const result = detectAlertCandidates(input({
      siteMode: "HARDWARE",
      readings: [
        reading(60, { batterySocPct: 8, quality: "MEASURED" }),
        reading(30, { batterySocPct: 7, quality: "MEASURED" }),
        reading(0, { batterySocPct: 6, quality: "MEASURED" }),
      ],
    }));

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "BATTERY_LOW", severity: "CRITICAL", evidenceQuality: "MEASURED" }),
    ]));
  });

  it("labels hardware connectivity evidence as measured", () => {
    const result = detectAlertCandidates(input({
      siteMode: "HARDWARE",
      devices: [{
        externalId: "meter-1",
        name: "Grid meter",
        kind: "GRID_METER",
        lastSeenAt: new Date(now.getTime() - 301_000),
        expectedIntervalSec: 30,
        operationalState: "RUNNING",
      }],
    }));

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "DEVICE_OFFLINE", severity: "CRITICAL", evidenceQuality: "MEASURED" }),
    ]));
  });
});
