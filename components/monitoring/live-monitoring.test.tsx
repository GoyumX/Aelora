import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTelemetry, LiveMonitoring } from "@/components/monitoring/live-monitoring";
import type { TelemetrySnapshot } from "@/lib/telemetry/types";

const swrState = vi.hoisted(() => ({
  data: undefined as { data: TelemetrySnapshot; meta: { refreshAfterSeconds: number } } | undefined,
  error: undefined as Error | undefined,
  isValidating: false,
  mutate: vi.fn(),
}));

vi.mock("swr", () => ({ default: () => swrState }));

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
  connectivity: {
    gateway: { id: "gateway-demo", name: "Virtual plant", status: "ONLINE", lastSeenAt: "2026-08-07T06:30:00.000Z", expectedIntervalSec: 30 },
    devices: [
      { externalId: "east", name: "East array", kind: "PV_ARRAY", status: "ONLINE", operationalState: "RUNNING", lastSeenAt: "2026-08-07T06:30:00.000Z" },
      { externalId: "inverter", name: "Main inverter", kind: "INVERTER", status: "ONLINE", operationalState: "RUNNING", lastSeenAt: "2026-08-07T06:30:00.000Z" },
    ],
  },
};

describe("LiveMonitoring", () => {
  beforeEach(() => {
    swrState.data = { data: telemetry, meta: { refreshAfterSeconds: 15 } };
    swrState.error = undefined;
    swrState.isValidating = false;
    swrState.mutate.mockReset();
  });

  it("shows freshness, source, scenario, and core real-time flows", () => {
    render(<LiveMonitoring initialTelemetry={telemetry} />);

    expect(screen.getByRole("heading", { level: 1, name: "Live Monitoring" })).toBeInTheDocument();
    expect(screen.getByText("Virtual gateway data")).toBeInTheDocument();
    expect(screen.getByText("Gateway online")).toBeInTheDocument();
    expect(screen.getByText("Main inverter")).toBeInTheDocument();
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

  it("renders import, discharge, fault, and refresh-failure states with text", () => {
    swrState.data = {
      data: {
        ...telemetry,
        deviceStatus: "INVERTER_FAULT",
        gridPowerW: 860,
        batteryPowerW: 900,
        scenario: { code: "INVERTER_FAULT", label: "Inverter fault", message: "The simulated inverter is offline." },
        arrays: telemetry.arrays.map((array) => ({ ...array, status: "OFFLINE" as const })),
      },
      meta: { refreshAfterSeconds: 15 },
    };
    swrState.error = new Error("offline");
    swrState.isValidating = true;

    render(<LiveMonitoring initialTelemetry={telemetry} />);

    expect(screen.getByText("Importing 0.86 kW")).toBeInTheDocument();
    expect(screen.getByText("Discharging 0.90 kW")).toBeInTheDocument();
    expect(screen.getByText("INVERTER FAULT")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/latest refresh failed/i);
    expect(screen.getAllByText("offline")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Refresh telemetry" })).toBeDisabled();
  });

  it("renders neutral, idle, and warning states and triggers manual refresh", () => {
    swrState.data = undefined;
    const warningTelemetry: TelemetrySnapshot = {
      ...telemetry,
      deviceStatus: "ARRAY_UNDERPERFORMING",
      gridPowerW: 0,
      batteryPowerW: 0,
      scenario: { code: "PARTIAL_SHADING", label: "Partial shading", message: "East array output is reduced." },
      arrays: [{ ...telemetry.arrays[0], status: "UNDERPERFORMING" }, telemetry.arrays[1]],
    };

    render(<LiveMonitoring initialTelemetry={warningTelemetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh telemetry" }));

    expect(screen.getByText("Grid neutral")).toBeInTheDocument();
    expect(screen.getByText("Battery idle")).toBeInTheDocument();
    expect(screen.getByText("ARRAY UNDERPERFORMING")).toBeInTheDocument();
    expect(screen.getByText("underperforming")).toBeInTheDocument();
    expect(swrState.mutate).toHaveBeenCalledOnce();
  });

  it("fetches telemetry and rejects unsuccessful responses", async () => {
    const responsePayload = { data: telemetry, meta: { refreshAfterSeconds: 15 } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(responsePayload) }).mockResolvedValueOnce({ ok: false }));

    await expect(fetchTelemetry("/telemetry")).resolves.toEqual(responsePayload);
    await expect(fetchTelemetry("/telemetry")).rejects.toThrow("Telemetry refresh failed");
    vi.unstubAllGlobals();
  });
});
