import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { AiForecastDashboard } from "@/components/forecast/ai-forecast-dashboard";
import type { SolarForecastView } from "@/lib/forecast/forecast-service";
import type { ForecastEvaluationView } from "@/lib/forecast/verification";

const forecast: SolarForecastView = {
  id: "forecast-1",
  requestId: "request-1",
  issuedAt: "2026-08-21T04:00:00.000Z",
  createdAt: "2026-08-21T04:01:00.000Z",
  installedCapacityKwp: 4.5,
  model: {
    name: "Aelora UNISOLAR capacity challenger v3",
    family: "random_forest",
    status: "CHALLENGER_NOT_ACTIVE",
    artifactSha256: "b".repeat(64),
    featureSchemaVersion: "1.0.0",
    productionActivationAllowed: false,
  },
  totals: { estimatedEnergyKwh: 12.4, estimatedLoadEnergyKwh: 18.7, daylightHours: 2 },
  loadForecast: { method: "HISTORICAL_HOURLY_MEDIAN" },
  limitations: ["Challenger model: production activation is not approved."],
  site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo" },
  weather: {
    runId: "weather-run-1",
    provider: "OPEN_METEO",
    fetchedAt: "2026-08-21T04:00:00.000Z",
    attribution: "Weather data by Open-Meteo.com",
  },
  points: [
    { validAt: "2026-08-21T05:00:00.000Z", leadHours: 1, capacityFactor: 0.4, estimatedPowerKw: 1.8, estimatedEnergyKwh: 1.8, estimatedLoadPowerKw: 1.25, estimatedLoadEnergyKwh: 1.25, source: "MODEL" },
    { validAt: "2026-08-22T05:00:00.000Z", leadHours: 25, capacityFactor: 0.5, estimatedPowerKw: 2.25, estimatedEnergyKwh: 2.25, estimatedLoadPowerKw: 1.4, estimatedLoadEnergyKwh: 1.4, source: "MODEL" },
  ],
};

const evaluation: ForecastEvaluationView = {
  siteId: "site-1",
  evaluatedAt: "2026-08-21T07:00:00.000Z",
  deduplicatedCount: 3,
  excludedNightCount: 1,
  evidenceQuality: "SIMULATED",
  overall: { sampleCount: 2, maeKwh: 0.5, rmseKwh: 0.707, biasKwh: 0.5, wMapePct: 25, meanActualEnergyKwh: 2 },
  slices: [
    { key: "H24", label: "1–24 hours", sampleCount: 2, maeKwh: 0.5, rmseKwh: 0.707, biasKwh: 0.5, wMapePct: 25, meanActualEnergyKwh: 2 },
    { key: "H48", label: "25–48 hours", sampleCount: 0, maeKwh: null, rmseKwh: null, biasKwh: null, wMapePct: null, meanActualEnergyKwh: null },
    { key: "H168", label: "49–168 hours", sampleCount: 0, maeKwh: null, rmseKwh: null, biasKwh: null, wMapePct: null, meanActualEnergyKwh: null },
  ],
  calibration: [
    { key: "H24", label: "1–24 hours", sampleCount: 24, status: "READY", halfWidthKwh: 0.8, coverageTargetPct: 90 },
    { key: "H48", label: "25–48 hours", sampleCount: 0, status: "COLLECTING", halfWidthKwh: null, coverageTargetPct: 90 },
    { key: "H168", label: "49–168 hours", sampleCount: 0, status: "COLLECTING", halfWidthKwh: null, coverageTargetPct: 90 },
  ],
  promotion: {
    status: "BLOCKED_SIMULATED_EVIDENCE",
    automaticActivationAllowed: false,
    reasons: ["Simulated telemetry cannot promote a production model."],
  },
};

describe("AI forecast dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: forecast }), { status: 201 })));
  });

  it("shows the stored seven-day evidence and honest challenger status", () => {
    render(<AiForecastDashboard forecast={forecast} now="2026-08-21T04:30:00.000Z" siteId="site-1" />);

    expect(screen.getByRole("heading", { name: "AI Forecast" })).toBeInTheDocument();
    expect(screen.getByText("Inactive challenger")).toBeInTheDocument();
    expect(screen.getByText("Next 48 hours")).toBeInTheDocument();
    expect(screen.getByText("7-day outlook")).toBeInTheDocument();
    expect(screen.getByText("Weather data by Open-Meteo.com")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /power generated versus household usage/i })).toBeInTheDocument();
    expect(screen.getByText("Power (kW)")).toBeInTheDocument();
    expect(screen.getByText("Forecast time (Asia/Colombo)")).toBeInTheDocument();
    expect(screen.getByText("Solar generation")).toBeInTheDocument();
    expect(screen.getByText("Household usage")).toBeInTheDocument();
    expect(screen.getByText(/historical hourly median/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh weather" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Research challenger limitations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Next-month outlook" })).not.toBeInTheDocument();
    const sevenDay = screen.getByRole("heading", { name: "Seven-day forecast" });
    const verification = screen.getByRole("heading", { name: "Prediction vs actual" });
    expect(sevenDay.compareDocumentPosition(verification) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("switches between 24-hour, 48-hour, and 7-day power curves", async () => {
    const user = userEvent.setup();
    render(<AiForecastDashboard forecast={forecast} now="2026-08-21T04:30:00.000Z" siteId="site-1" />);

    expect(screen.getByRole("heading", { name: "48-hour power curve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "24 hours" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "48 hours" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "7 days" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "7 days" }));
    expect(screen.getByRole("heading", { name: "7-day power curve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");

    await user.hover(screen.getByRole("slider", { name: /7-day power curve/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Fri, Aug 21 · 10:30");
  });

  it("generates through the owner-scoped Next.js route and refreshes stored data", async () => {
    const user = userEvent.setup();
    render(<AiForecastDashboard forecast={forecast} now="2026-08-21T04:30:00.000Z" siteId="site-1" />);

    await user.click(screen.getByRole("button", { name: "Rerun AI forecast" }));

    expect(fetch).toHaveBeenCalledWith("/api/sites/site-1/weather", { method: "POST" });
    expect(fetch).toHaveBeenCalledWith("/api/sites/site-1/forecast", { method: "POST" });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("explains the prerequisite when no stored forecast exists", () => {
    render(<AiForecastDashboard forecast={null} now="2026-08-21T04:30:00.000Z" siteId="site-1" />);

    expect(screen.getByText("Generate your first forecast")).toBeInTheDocument();
    expect(screen.getByText(/stored Open-Meteo weather/i)).toBeInTheDocument();
  });

  it("labels household usage unavailable instead of drawing invented history", () => {
    const withoutLoadHistory: SolarForecastView = {
      ...forecast,
      totals: { ...forecast.totals, estimatedLoadEnergyKwh: null },
      loadForecast: { method: "NO_HISTORY" },
      points: forecast.points.map((point) => ({
        ...point,
        estimatedLoadPowerKw: null,
        estimatedLoadEnergyKwh: null,
      })),
    };

    render(<AiForecastDashboard forecast={withoutLoadHistory} now="2026-08-21T04:30:00.000Z" siteId="site-1" />);

    expect(screen.getByText(/Unavailable — waiting for household telemetry history/i)).toBeInTheDocument();
  });

  it("shows prediction-versus-actual evidence, uncertainty, and the blocked promotion state", () => {
    render(<AiForecastDashboard evaluation={evaluation} forecast={forecast} now="2026-08-21T04:30:00.000Z" siteId="site-1" />);

    expect(screen.getByRole("heading", { name: "Prediction vs actual" })).toBeInTheDocument();
    expect(screen.getByText("Simulator evidence")).toBeInTheDocument();
    expect(screen.getAllByText("0.50 kWh").length).toBeGreaterThan(0);
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("Blocked from promotion")).toBeInTheDocument();
    expect(screen.getByText(/90% empirical envelope/i)).toBeInTheDocument();
    expect(screen.getByText("±0.80 kWh")).toBeInTheDocument();
  });

  it("refreshes completed actual labels through the owner-scoped route", async () => {
    const user = userEvent.setup();
    render(<AiForecastDashboard evaluation={evaluation} forecast={forecast} now="2026-08-21T04:30:00.000Z" siteId="site-1" />);

    await user.click(screen.getByRole("button", { name: "Refresh actuals" }));

    expect(fetch).toHaveBeenCalledWith("/api/sites/site-1/forecast/evaluation", { method: "POST" });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
