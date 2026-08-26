import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMocks }));

import { AlertsDashboard } from "@/components/alerts/alerts-dashboard";
import type { AlertsView } from "@/lib/alerts/types";

const view: AlertsView = {
  site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo", mode: "SIMULATED" },
  summary: { open: 2, critical: 1, acknowledged: 1, resolved: 1 },
  incidents: [
    {
      id: "alert-1",
      type: "GRID_OUTAGE",
      severity: "CRITICAL",
      status: "ACTIVE",
      title: "Grid outage detected",
      summary: "Grid voltage stayed below 10 V for 60 seconds.",
      evidenceQuality: "SIMULATED",
      evidence: { voltageV: 0, sampleCount: 3 },
      firstDetectedAt: "2026-08-21T07:55:00.000Z",
      lastDetectedAt: "2026-08-21T08:00:00.000Z",
      occurrenceCount: 3,
      acknowledgedAt: null,
      resolvedAt: null,
      resolutionReason: null,
    },
    {
      id: "alert-2",
      type: "BATTERY_LOW",
      severity: "WARNING",
      status: "ACKNOWLEDGED",
      title: "Battery below reserve",
      summary: "Battery stayed below its configured reserve.",
      evidenceQuality: "MEASURED",
      evidence: { batterySocPct: 16, reservePct: 20 },
      firstDetectedAt: "2026-08-21T07:30:00.000Z",
      lastDetectedAt: "2026-08-21T07:59:30.000Z",
      occurrenceCount: 5,
      acknowledgedAt: "2026-08-21T07:45:00.000Z",
      resolvedAt: null,
      resolutionReason: null,
    },
    {
      id: "alert-3",
      type: "DEVICE_OFFLINE",
      severity: "WARNING",
      status: "RESOLVED",
      title: "Battery pack stopped reporting",
      summary: "No data arrived within the offline grace window.",
      evidenceQuality: "SIMULATED",
      evidence: { deviceName: "Battery pack" },
      firstDetectedAt: "2026-08-20T10:00:00.000Z",
      lastDetectedAt: "2026-08-20T10:05:00.000Z",
      occurrenceCount: 2,
      acknowledgedAt: null,
      resolvedAt: "2026-08-20T10:10:00.000Z",
      resolutionReason: "EVIDENCE_CLEARED",
    },
  ],
};

describe("AlertsDashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("shows evidence, lifecycle state, and honest simulator provenance", () => {
    render(<AlertsDashboard initialView={view} />);

    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();
    expect(screen.getByText("Grid outage detected")).toBeInTheDocument();
    expect(screen.getByText("Simulator evidence")).toBeInTheDocument();
    expect(screen.getByText("2 open incidents")).toBeInTheDocument();
    expect(screen.getByText(/rules-based operational signals/i)).toBeInTheDocument();
  });

  it("filters resolved incident history", () => {
    render(<AlertsDashboard initialView={view} />);

    fireEvent.click(screen.getByRole("button", { name: /resolved/i }));

    expect(screen.getByText("Battery pack stopped reporting")).toBeInTheDocument();
    expect(screen.queryByText("Grid outage detected")).not.toBeInTheDocument();
  });

  it("acknowledges an incident through the owner-scoped API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { incident: { ...view.incidents[0], status: "ACKNOWLEDGED", acknowledgedAt: "2026-08-21T08:01:00.000Z" } } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<AlertsDashboard initialView={view} />);

    fireEvent.click(screen.getByRole("button", { name: "Acknowledge Grid outage detected" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/sites/site-1/alerts/alert-1", expect.objectContaining({ method: "PATCH" })));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Acknowledge Grid outage detected" })).not.toBeInTheDocument());
    expect(toastMocks.success).toHaveBeenCalledWith("Incident acknowledged");
  });

  it("re-evaluates current evidence and replaces the incident view", async () => {
    const refreshedView: AlertsView = { ...view, summary: { open: 0, critical: 0, acknowledged: 0, resolved: 0 }, incidents: [] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { refresh: { resolved: 2 }, view: refreshedView } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<AlertsDashboard initialView={view} />);

    fireEvent.click(screen.getByRole("button", { name: "Evaluate current evidence" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/sites/site-1/alerts", { method: "POST" }));
    await waitFor(() => expect(screen.getByText("No incidents in this view")).toBeInTheDocument());
    expect(toastMocks.success).toHaveBeenCalledWith("Alert evidence refreshed");
  });

  it("keeps the current incident available when a lifecycle request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "Request rejected" } }), { status: 409, headers: { "Content-Type": "application/json" } }));
    render(<AlertsDashboard initialView={view} />);

    fireEvent.click(screen.getByRole("button", { name: "Resolve Grid outage detected" }));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Request rejected"));
    expect(screen.getByText("Grid outage detected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve Grid outage detected" })).toBeEnabled();
  });

  it("reports an evidence refresh failure without discarding the current list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "Evaluator unavailable" } }), { status: 500, headers: { "Content-Type": "application/json" } }));
    render(<AlertsDashboard initialView={view} />);

    fireEvent.click(screen.getByRole("button", { name: "Evaluate current evidence" }));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Evaluator unavailable"));
    expect(screen.getByText("Grid outage detected")).toBeInTheDocument();
  });
});
