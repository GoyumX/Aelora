import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";

const snapshot: DashboardSnapshot = {
  site: { id: "site-demo", name: "Colombo Home", mode: "SIMULATED", status: "ACTIVE" },
  observedAt: "2026-08-07T06:30:00.000Z",
  sourceLabel: "Deterministic digital twin",
  metrics: {
    pvPowerKw: 4.82,
    energyTodayKwh: 18.4,
    loadPowerKw: 1.76,
    batteryPowerKw: -1.2,
    batterySocPct: 76,
    gridPowerKw: -1.86,
    weather: { condition: "Partly cloudy", temperatureC: 29, irradianceWm2: 724 },
  },
  intraday: Array.from({ length: 13 }, (_, hour) => ({
    label: `${hour + 6}:00`,
    generationKw: Math.max(0, 5 - Math.abs(12 - (hour + 6))),
    consumptionKw: 1.4,
  })),
  forecast: [
    { label: "Tomorrow", condition: "Mostly sunny", predictedEnergyKwh: 24.8, confidencePct: 88 },
    { label: "Day after", condition: "Cloud intervals", predictedEnergyKwh: 20.6, confidencePct: 81 },
  ],
  alert: {
    severity: "INFO",
    title: "No active system faults",
    detail: "The simulated inverter, battery, and grid connection are operating normally.",
  },
  recommendation: "Run the dishwasher between 11:00 and 14:00 to use the expected solar surplus.",
};

describe("DashboardOverview", () => {
  it("answers the primary health and energy questions", () => {
    render(<DashboardOverview snapshot={snapshot} />);

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Simulation mode")).toBeInTheDocument();
    expect(screen.getAllByText("4.82 kW").length).toBeGreaterThan(0);
    expect(screen.getByText("18.4 kWh")).toBeInTheDocument();
    expect(screen.getAllByText("76%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exporting 1.86 kW").length).toBeGreaterThan(0);
  });

  it("shows an accessible trend, two-day forecast, alert, recommendation, and next actions", () => {
    render(<DashboardOverview snapshot={snapshot} />);

    expect(screen.getByRole("img", { name: /intraday solar generation and household consumption/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "48-hour AI forecast" })).toBeInTheDocument();
    expect(screen.getAllByText(/confidence/i)).toHaveLength(2);
    expect(screen.getByText("No active system faults")).toBeInTheDocument();
    expect(screen.getByText(/Run the dishwasher/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open live monitoring/i })[0]).toHaveAttribute("href", "/live-monitoring");
    expect(screen.getAllByRole("link", { name: /View full AI forecast/i })[0]).toHaveAttribute("href", "/ai-forecast");
  });
});
