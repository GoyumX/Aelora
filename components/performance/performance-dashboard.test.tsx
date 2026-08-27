import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PerformanceDashboard } from "@/components/performance/performance-dashboard";
import type { PerformanceReport } from "@/lib/performance/performance";

const report: PerformanceReport = {
  site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo" },
  sourceLabel: "Simulated gateway data",
  range: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T00:00:00.000Z", days: 30 },
  summary: { actualGenerationWh: 215_000, expectedGenerationWh: 240_000, performanceRatioPct: 89.6, estimatedLossWh: 25_000, availabilityPct: 97.5, configuredCapacityW: 6_160 },
  points: [
    { bucketStart: "2026-08-01T00:00:00.000Z", label: "Aug 1", actualGenerationWh: 7_200, expectedGenerationWh: 8_000, estimatedLossWh: 800 },
    { bucketStart: "2026-08-02T00:00:00.000Z", label: "Aug 2", actualGenerationWh: 6_400, expectedGenerationWh: 8_200, estimatedLossWh: 1_800 },
  ],
  arrays: [
    { id: "array-east", name: "East roof", ratedCapacityW: 3_080, actualGenerationWh: 72_000, expectedGenerationWh: 105_000, performanceRatioPct: 68.6, availabilityPct: 96, observationCount: 72, status: "UNDERPERFORMING", explanation: "Output is below the modeled range." },
    { id: "array-west", name: "West roof", ratedCapacityW: 3_080, actualGenerationWh: 103_000, expectedGenerationWh: 105_000, performanceRatioPct: 98.1, availabilityPct: 99, observationCount: 72, status: "HEALTHY", explanation: "Output is within the modeled range." },
  ],
};

describe("PerformanceDashboard", () => {
  it("answers health, expected-output, loss, availability, and array-risk questions", () => {
    render(<PerformanceDashboard report={report} />);

    expect(screen.getByRole("heading", { name: "Performance" })).toBeInTheDocument();
    expect(screen.getByText("Simulated gateway data")).toBeInTheDocument();
    expect(screen.getByText("89.6%")).toBeInTheDocument();
    expect(screen.getByText("25.0 kWh")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /actual and predicted generation/i })).toBeInTheDocument();
    expect(screen.getAllByText("Predicted production").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "East roof" })).toBeInTheDocument();
    expect(screen.getByText("Underperforming")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "How the modeled estimate works" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Amber is stored production/i)).not.toBeInTheDocument();
  });

  it("shows distinct actual and predicted values and places array health below the full-width chart", async () => {
    const user = userEvent.setup();
    render(<PerformanceDashboard report={report} />);

    await user.hover(screen.getByRole("slider", { name: /actual and predicted generation/i }));
    expect(screen.getByRole("status")).toHaveTextContent("DayAug 1");
    expect(screen.getByRole("status")).toHaveTextContent("Actual production7.2 kWh");
    expect(screen.getByRole("status")).toHaveTextContent("Predicted production8.0 kWh");

    const chart = screen.getByRole("heading", { name: "Actual vs predicted production" });
    const arrayHealth = screen.getByRole("heading", { name: /array.*need attention/i });
    expect(chart.compareDocumentPosition(arrayHealth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders an honest empty state when no performance evidence exists", () => {
    render(<PerformanceDashboard report={{ ...report, points: [], arrays: [], summary: { ...report.summary, actualGenerationWh: 0, expectedGenerationWh: 0, performanceRatioPct: null, estimatedLossWh: 0, availabilityPct: 0 } }} />);

    expect(screen.getByText("No performance evidence in this range")).toBeInTheDocument();
    expect(screen.getByText("Insufficient data")).toBeInTheDocument();
  });

  it("distinguishes healthy arrays from arrays without enough evidence", () => {
    render(<PerformanceDashboard report={{
      ...report,
      arrays: [
        report.arrays[1],
        { ...report.arrays[0], id: "array-new", name: "New roof", actualGenerationWh: 0, expectedGenerationWh: 0, performanceRatioPct: null, availabilityPct: 0, observationCount: 0, status: "INSUFFICIENT_DATA", explanation: "Not enough matched array observations to assess this range." },
      ],
    }} />);

    expect(screen.getByRole("heading", { name: "Arrays are within range" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New roof" })).toBeInTheDocument();
    expect(screen.getAllByText("Insufficient data")).toHaveLength(2);
    expect(screen.getByText("No evidence")).toBeInTheDocument();
  });
});
