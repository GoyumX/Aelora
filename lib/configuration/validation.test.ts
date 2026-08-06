import { describe, expect, it } from "vitest";

import {
  batteryConfigurationSchema,
  inverterConfigurationSchema,
  solarArraySchema,
  siteConfigurationSchema,
} from "@/lib/configuration/validation";

describe("configuration validation", () => {
  it("accepts a valid site and rejects impossible coordinates", () => {
    expect(siteConfigurationSchema.safeParse({ name: "Colombo Home", latitude: 6.9271, longitude: 79.8612, timezone: "Asia/Colombo" }).success).toBe(true);
    expect(siteConfigurationSchema.safeParse({ name: "Home", latitude: 96, longitude: 79, timezone: "Asia/Colombo" }).success).toBe(false);
  });

  it("validates panel counts, ratings, tilt, and azimuth", () => {
    const valid = { name: "West roof", manufacturer: "Jinko", model: "Tiger Neo", panelCount: 10, ratedPowerW: 440, tiltDeg: 18, azimuthDeg: 260 };

    expect(solarArraySchema.safeParse(valid).success).toBe(true);
    expect(solarArraySchema.safeParse({ ...valid, panelCount: 0 }).success).toBe(false);
    expect(solarArraySchema.safeParse({ ...valid, azimuthDeg: 361 }).success).toBe(false);
  });

  it("validates inverter and battery operating limits", () => {
    expect(inverterConfigurationSchema.safeParse({ manufacturer: "Huawei", model: "SUN2000", serialAlias: "Roof inverter", acRatingW: 5000, efficiencyPct: 98.2, phase: 1, communicationAdapter: "SIMULATOR", pollingIntervalSec: 15 }).success).toBe(true);
    expect(batteryConfigurationSchema.safeParse({ enabled: true, manufacturer: "BYD", model: "HVS", usableCapacityWh: 7680, maxChargePowerW: 3000, maxDischargePowerW: 3000, minSocPct: 10, maxSocPct: 95, roundTripEfficiencyPct: 92, reservePct: 20 }).success).toBe(true);
    expect(batteryConfigurationSchema.safeParse({ enabled: true, usableCapacityWh: 1000, maxChargePowerW: 1000, maxDischargePowerW: 1000, minSocPct: 80, maxSocPct: 20, roundTripEfficiencyPct: 92, reservePct: 20 }).success).toBe(false);
  });
});
