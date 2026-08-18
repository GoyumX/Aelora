import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HistoricalAnalytics } from "@/components/analytics/historical-analytics";

const history = {
  site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo" },
  range: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-03T00:00:00.000Z", grain: "day" as const },
  points: [
    { bucketStart: "2026-08-01T00:00:00.000Z", label: "Aug 1", generationWh: 12000, consumptionWh: 9000, importWh: 1000, exportWh: 4000, batteryChargeWh: 2000, batteryDischargeWh: 1000, averageIrradianceWm2: 420, sampleCount: 24 },
    { bucketStart: "2026-08-02T00:00:00.000Z", label: "Aug 2", generationWh: 10000, consumptionWh: 9500, importWh: 1500, exportWh: 2000, batteryChargeWh: 1000, batteryDischargeWh: 500, averageIrradianceWm2: 380, sampleCount: 24 },
  ],
  summary: { generationWh: 22000, consumptionWh: 18500, importWh: 2500, exportWh: 6000, selfConsumptionPct: 72.7 },
  comparison: { generationChangePct: 10, consumptionChangePct: -2 },
  completenessPct: 100,
};

describe("HistoricalAnalytics", () => {
  it("communicates source, completeness, trends, comparison, and CSV export", () => {
    render(<HistoricalAnalytics history={history} />);

    expect(screen.getByRole("heading", { name: "Historical analytics" })).toBeInTheDocument();
    expect(screen.getByText("100% complete")).toBeInTheDocument();
    expect(screen.getByText("Simulated history")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /generation and consumption history/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /export csv/i })).toHaveAttribute("download");
  });
});
