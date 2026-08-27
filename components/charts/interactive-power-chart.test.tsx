import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { InteractivePowerChart } from "@/components/charts/interactive-power-chart";

describe("InteractivePowerChart", () => {
  it("shows the point's x-axis time and both y-axis series in a floating tooltip", async () => {
    const user = userEvent.setup();
    render(<InteractivePowerChart
      ariaLabel="Forecast power"
      description="Solar generation and household usage"
      points={[
        { id: "p1", dateTime: "2026-08-25T05:00:00.000Z", axisLabel: "10:30", tooltipLabel: "Tue, Aug 25 · 10:30", generation: 2.42, consumption: 1.36 },
        { id: "p2", dateTime: "2026-08-25T06:00:00.000Z", axisLabel: "11:30", tooltipLabel: "Tue, Aug 25 · 11:30", generation: 3.1, consumption: 1.5 },
      ]}
      seriesLabels={{ generation: "Solar forecast", consumption: "Household usage" }}
      unit="kW"
      xAxisLabel="Forecast date and time"
    />);

    await user.hover(screen.getByRole("slider", { name: /forecast power/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Tue, Aug 25 · 10:30");
    expect(screen.getByRole("status")).toHaveTextContent("Solar forecast2.42 kW");
    expect(screen.getByRole("status")).toHaveTextContent("Household usage1.36 kW");
  });

  it("also reveals the tooltip with keyboard focus", async () => {
    const user = userEvent.setup();
    render(<InteractivePowerChart
      ariaLabel="Observed power"
      description="Observed solar and demand"
      points={[{ id: "p1", dateTime: "2026-08-25T00:00:00.000Z", axisLabel: "00:00", tooltipLabel: "Today · 00:00", generation: 0, consumption: 0.72 }]}
      seriesLabels={{ generation: "Generated", consumption: "Consumed" }}
      unit="kW"
      xAxisLabel="Site local time"
    />);

    await user.tab();
    expect(screen.getByRole("status")).toHaveTextContent("Today · 00:00");
  });

  it("renders separate line segments across missing telemetry windows", () => {
    const { container } = render(<InteractivePowerChart
      ariaLabel="Observed power"
      description="Observed solar and demand"
      points={[
        { id: "p1", dateTime: "2026-08-25T00:00:00.000Z", axisLabel: "00:00", tooltipLabel: "00:00", generation: 0, consumption: 1.2 },
        { id: "p2", dateTime: "2026-08-25T00:05:00.000Z", axisLabel: "00:05", tooltipLabel: "00:05", generation: 0, consumption: 1.3 },
        { id: "p3", dateTime: "2026-08-25T02:00:00.000Z", axisLabel: "02:00", tooltipLabel: "02:00", generation: 0, consumption: 1.4, breakBefore: true },
        { id: "p4", dateTime: "2026-08-25T02:05:00.000Z", axisLabel: "02:05", tooltipLabel: "02:05", generation: 0.1, consumption: 1.5 },
      ]}
      seriesLabels={{ generation: "Generated", consumption: "Consumed" }}
      unit="kW"
      xAxisLabel="Site local time"
    />);

    expect(container.querySelectorAll("polyline")).toHaveLength(4);
  });
});
