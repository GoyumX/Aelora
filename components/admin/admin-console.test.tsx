import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminConsole } from "@/components/admin/admin-console";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const view = {
  generatedAt: "2026-08-22T10:00:00.000Z", currentAdminId: "admin-1",
  summary: { users: 2, activeUsers: 2, openTickets: 1, onlineGateways: 1, modelArtifacts: 1 },
  health: { database: { state: "HEALTHY" as const, detail: "PostgreSQL query completed" }, telemetry: { state: "FRESH" as const, at: "2026-08-22T09:59:30.000Z", source: "SIMULATOR" }, weather: { state: "FRESH" as const, at: "2026-08-22T09:46:00.000Z" }, weatherForecast: { state: "FRESH" as const, at: "2026-08-22T09:40:00.000Z" }, solarForecast: { state: "FRESH" as const, at: "2026-08-22T09:30:00.000Z" } },
  users: [
    { id: "admin-1", name: "Aelora Admin", email: "admin@aelora.local", role: "ADMIN" as const, status: "ACTIVE" as const, createdAt: "2026-08-01T00:00:00.000Z", siteCount: 1, sessionCount: 1 },
    { id: "user-1", name: "Aelora User", email: "user@aelora.local", role: "USER" as const, status: "ACTIVE" as const, createdAt: "2026-08-01T00:00:00.000Z", siteCount: 1, sessionCount: 2 },
  ],
  tickets: [{ id: "ticket-1", category: "TECHNICAL" as const, priority: "NORMAL" as const, status: "OPEN" as const, subject: "Demo gateway help", message: "The gateway stopped publishing telemetry.", adminResponse: null, respondedAt: null, resolvedAt: null, createdAt: "2026-08-22T09:00:00.000Z", updatedAt: "2026-08-22T09:00:00.000Z", user: { id: "user-1", name: "Aelora User", email: "user@aelora.local" }, site: null }],
  gateways: [{ id: "gw-1", name: "Virtual plant", mode: "VIRTUAL" as const, status: "ONLINE" as const, freshness: "FRESH" as const, expectedIntervalSec: 30, lastSeenAt: "2026-08-22T09:59:30.000Z", lastTelemetryAt: "2026-08-22T09:59:30.000Z", softwareVersion: "0.2.0", site: { id: "site-1", name: "Colombo Home" } }],
  models: [{ modelName: "rf-unisolar", modelFamily: "RandomForest", modelStatus: "inactive_candidate", artifactSha256: "a".repeat(64), featureSchemaVersion: "1.0", productionActivationAllowed: false, lastUsedAt: "2026-08-22T09:30:00.000Z", siteName: "Colombo Home" }],
  audits: [{ id: "audit-1", action: "USER_STATUS_CHANGED" as const, summary: "User access changed", createdAt: "2026-08-22T09:00:00.000Z", actor: { name: "Aelora Admin", email: "admin@aelora.local" }, targetUser: { name: "Aelora User", email: "user@aelora.local" }, supportTicket: null }],
};
describe("AdminConsole", () => {
  it("renders health, model provenance, gateway boundary, and audit evidence", () => { render(<AdminConsole view={view} />); expect(screen.getByText("Platform health")).toBeInTheDocument(); expect(screen.getByText("rf-unisolar")).toBeInTheDocument(); expect(screen.getByText("Virtual plant")).toBeInTheDocument(); expect(screen.getByText(/scenario controls stay in the separate gateway console/i)).toBeInTheDocument(); expect(screen.getByText("User access changed")).toBeInTheDocument(); });
  it("disables another user through the admin API", async () => { const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { ...view.users[1], status: "DISABLED" } }) }); vi.stubGlobal("fetch", fetchMock); render(<AdminConsole view={view} />); fireEvent.click(screen.getByRole("button", { name: "Disable Aelora User" })); await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/user-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "DISABLED" }) }))); expect(await screen.findByRole("button", { name: "Activate Aelora User" })).toBeInTheDocument(); });
  it("responds to a support ticket and resolves it", async () => { const updated = { ...view.tickets[0], status: "RESOLVED", adminResponse: "Publishing recovered after credential rotation." }; vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: updated }) })); render(<AdminConsole view={view} />); fireEvent.change(screen.getByLabelText("Status for Demo gateway help"), { target: { value: "RESOLVED" } }); fireEvent.change(screen.getByLabelText("Response for Demo gateway help"), { target: { value: updated.adminResponse } }); fireEvent.click(screen.getByRole("button", { name: "Save ticket Demo gateway help" })); expect(await screen.findByText(updated.adminResponse)).toBeInTheDocument(); });

  it("renders empty operations and missing gateway evidence honestly, then activates a disabled user", async () => {
    const disabled = { ...view.users[1], status: "DISABLED" as const, sessionCount: 0 };
    const emptyView = {
      ...view, summary: { users: 2, activeUsers: 1, openTickets: 0, onlineGateways: 0, modelArtifacts: 0 }, users: [view.users[0], disabled], tickets: [], models: [], audits: [],
      health: { ...view.health, telemetry: { state: "MISSING" as const, at: null, source: null }, weather: { state: "STALE" as const, at: null }, weatherForecast: { state: "MISSING" as const, at: null }, solarForecast: { state: "MISSING" as const, at: null } },
      gateways: [{ ...view.gateways[0], status: "OFFLINE", freshness: "OFFLINE" as const, lastSeenAt: null, lastTelemetryAt: null, softwareVersion: null }],
    };
    const activated = { ...disabled, status: "ACTIVE" as const };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: activated }) }));
    render(<AdminConsole view={emptyView} />);
    expect(screen.getByText("No support tickets")).toBeInTheDocument();
    expect(screen.getByText("No stored model runs")).toBeInTheDocument();
    expect(screen.getByText("No administrative mutations yet")).toBeInTheDocument();
    expect(screen.getAllByText("No evidence yet").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Activate Aelora User" }));
    expect(await screen.findByRole("button", { name: "Disable Aelora User" })).toBeInTheDocument();
  });

  it("renders production-allowed model, high-priority answered ticket, site, and deleted actor evidence", () => {
    render(<AdminConsole view={{
      ...view,
      models: [{ ...view.models[0], productionActivationAllowed: true }],
      tickets: [{ ...view.tickets[0], priority: "HIGH", status: "IN_PROGRESS", site: { id: "site-1", name: "Colombo Home" }, adminResponse: "We are checking the gateway logs." }],
      audits: [{ ...view.audits[0], actor: null }],
    }} />);
    expect(screen.getByText("Activation allowed")).toBeInTheDocument();
    expect(screen.getByText("High priority")).toBeInTheDocument();
    expect(screen.getByText(/Stored response:/)).toBeInTheDocument();
    expect(screen.getByText(/Deleted administrator/)).toBeInTheDocument();
  });

  it("keeps the current UI state and shows safe errors when admin mutations fail", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: { message: "User update rejected." } }) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.reject(new Error("invalid response")) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Disable Aelora User" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Save ticket Demo gateway help" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Disable Aelora User" })).toBeInTheDocument();
  });
});
