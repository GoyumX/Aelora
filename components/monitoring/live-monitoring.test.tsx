import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveMonitoring } from "@/components/monitoring/live-monitoring";
import type { TelemetrySnapshot } from "@/lib/telemetry/types";

const telemetry: TelemetrySnapshot = {
  siteId: "site-demo",
  siteName: "Colombo Home",
  source: "SIMULATOR",
  quality: "SIMULATED",
  observedAt: "2026-08-07T06:30:00.000Z",
  scenario: { code: "NORMAL", label: "Normal operation", message: "Deterministic normal-day simulation is active." },
  deviceStatus: "NORMAL",
  pvPowerW: 4820,
  pvEnergyTodayWh: 18400,
  loadPowerW: 1760,
  gridPowerW: -1860,
  batteryPowerW: -1200,
  batterySocPct: 76,
  dcVoltageV: 372,
  dcCurrentA: 13.2,
  acVoltageV: 231,
  acCurrentA: 20.9,
  gridVoltageV: 230,
  frequencyHz: 50,
  inverterTemperatureC: 44,
  panelTemperatureC: 49,
  irradianceWm2: 724,
  arrays: [
    { id: "east", name: "East array", powerW: 2110, status: "NORMAL" },
    { id: "west", name: "West array", powerW: 2710, status: "NORMAL" },
  ],
  series: Array.from({ length: 13 }, (_, index) => ({
    observedAt: new Date(2026, 7, 7, 11, index * 5).toISOString(),
    pvPowerW: 3600 + index * 100,
    loadPowerW: 1400 + index * 20,
  })),
};

describe("LiveMonitoring", () => {
  it("shows freshness, source, scenario, and core real-time flows", () => {
    render(<LiveMonitoring initialTelemetry={telemetry} />);

    expect(screen.getByRole("heading", { level: 1, name: "Live Monitoring" })).toBeInTheDocument();
    expect(screen.getByText("Simulated data")).toBeInTheDocument();
    expect(screen.getByText("Normal operation")).toBeInTheDocument();
    expect(screen.getByText("4.82 kW")).toBeInTheDocument();
    expect(screen.getByText("Exporting 1.86 kW")).toBeInTheDocument();
    expect(screen.getByText("76%")).toBeInTheDocument();
  });

  it("shows detailed electrical, thermal, array, and accessible trend information", () => {
    render(<LiveMonitoring initialTelemetry={telemetry} />);

    expect(screen.getByRole("heading", { name: "Electrical measurements" })).toBeInTheDocument();
    expect(screen.getByText("372 V")).toBeInTheDocument();
    expect(screen.getByText("50.00 Hz")).toBeInTheDocument();
    expect(screen.getByText("East array")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /last-hour solar and household power/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh telemetry" })).toBeInTheDocument();
  });
});
