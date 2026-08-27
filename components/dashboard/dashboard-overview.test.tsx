import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";

const snapshot: DashboardSnapshot = {
  site: { id: "site-demo", name: "Colombo Home", mode: "SIMULATED", status: "ACTIVE", timezone: "Asia/Colombo", latitude: 6.9271, longitude: 79.8612 },
  observedAt: "2026-08-07T06:30:00.000Z",
  dayWindow: { startAt: "2026-08-06T18:30:00.000Z", endAt: "2026-08-07T06:30:00.000Z" },
  forecastUpdatedAt: "2026-08-07T06:00:00.000Z",
  sourceLabel: "Deterministic digital twin",
  connectivityStatus: "ONLINE",
  metrics: {
    pvPowerKw: 4.82,
    energyTodayKwh: 18.4,
    loadPowerKw: 1.76,
    batteryPowerKw: -1.2,
    batterySocPct: 76,
    gridPowerKw: -1.86,
    weather: {
      condition: "Partly cloudy",
      temperatureC: 29,
      irradianceWm2: 724,
      temperatureLabel: "Air temperature",
      irradianceLabel: "Global irradiance",
      source: "OPEN_METEO",
      sourceLabel: "Open-Meteo",
      freshness: "FRESH",
      observedAt: "2026-08-07T06:30:00.000Z",
      fetchedAt: "2026-08-07T06:35:00.000Z",
      cloudCoverPct: 42,
      precipitationMm: 0,
      relativeHumidityPct: 74,
      windSpeedKmh: 13.2,
      hourly: [
        { validAt: "2026-08-07T07:00:00.000Z", condition: "Partly cloudy", temperatureC: 29, precipitationProbabilityPct: 20, windSpeedKmh: 13, irradianceWm2: 700 },
      ],
      daily: [
        { dateKey: "2026-08-07", label: "Fri", condition: "Partly cloudy", temperatureMinC: 26, temperatureMaxC: 31, precipitationProbabilityPct: 30 },
      ],
    },
  },
  intraday: Array.from({ length: 13 }, (_, hour) => ({
    observedAt: new Date(Date.parse("2026-08-07T06:24:00.000Z") + hour * 30_000).toISOString(),
    label: `${hour + 6}:00`,
    generationKw: Math.max(0, 5 - Math.abs(12 - (hour + 6))),
    consumptionKw: 1.4,
  })),
  forecast: [
    { label: "Tomorrow", predictedEnergyKwh: 24.8 },
    { label: "Day after", predictedEnergyKwh: 20.6 },
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
    expect(screen.getByText("Virtual gateway")).toBeInTheDocument();
    expect(screen.getByText("● Connected")).toBeInTheDocument();
    expect(screen.getAllByText("4.82 kW")).toHaveLength(1);
    expect(screen.getByText("18.4 kWh")).toBeInTheDocument();
    expect(screen.getAllByText("76%")).toHaveLength(1);
    expect(screen.getAllByText("Exporting 1.86 kW")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Energy flow now" })).not.toBeInTheDocument();
  });

  it("shows an accessible trend, two-day forecast, alert, recommendation, and next actions", () => {
    render(<DashboardOverview snapshot={snapshot} />);

    expect(screen.getByRole("img", { name: /intraday solar generation and household consumption/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "48-hour AI forecast" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh weather" })).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.getByText("No active system faults")).toBeInTheDocument();
    expect(screen.getByText(/Run the dishwasher/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open live monitoring/i })[0]).toHaveAttribute("href", "/live-monitoring");
    expect(screen.getAllByRole("link", { name: /View full AI forecast/i })[0]).toHaveAttribute("href", "/ai-forecast");
  });

  it("identifies the weather provider, freshness, and required attribution", () => {
    render(<DashboardOverview snapshot={snapshot} />);

    expect(screen.getByText("Fresh")).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo · fetched/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toHaveAttribute("href", "https://open-meteo.com/");
    expect(screen.getByText("42% · 0 mm")).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText("13.2 km/h")).toBeInTheDocument();
    expect(screen.getByText(/6.9271, 79.8612/)).toBeInTheDocument();
    expect(screen.getByText(/Location from System Configuration/i)).toBeInTheDocument();
  });

  it("labels the chart with its real stored sample window instead of future clock times", () => {
    render(<DashboardOverview snapshot={snapshot} />);

    expect(screen.getByText(/Recent observed power/i)).toBeInTheDocument();
    expect(screen.queryByText(/Today from 00:00 through now/i)).not.toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.queryByText("18:00")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-observed-power-card")).toHaveClass("max-w-6xl");
  });

  it("shows local time and generated/consumed power in a floating chart tooltip", async () => {
    const user = userEvent.setup();
    render(<DashboardOverview snapshot={snapshot} />);

    await user.hover(screen.getByRole("slider", { name: /intraday solar generation/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/Generated/);
    expect(screen.getByRole("status")).toHaveTextContent(/Consumed/);
  });

  it("places the landscape weather panel after the observed-power graph", () => {
    render(<DashboardOverview snapshot={snapshot} />);
    const chart = screen.getByRole("heading", { name: "Recent observed power" });
    const weather = screen.getByRole("heading", { name: "Weather & solar conditions" });
    expect(chart.compareDocumentPosition(weather) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("dashboard-weather-landscape")).toBeInTheDocument();
  });
});
