import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUsers: vi.fn(), findUser: vi.fn(), updateUser: vi.fn(), deleteSessions: vi.fn(),
  findTickets: vi.fn(), findTicket: vi.fn(), updateTicket: vi.fn(), findGateways: vi.fn(), findForecasts: vi.fn(),
  findWeather: vi.fn(), findWeatherForecast: vi.fn(), findTelemetry: vi.fn(), findAudits: vi.fn(), createAudit: vi.fn(), transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {
  user: { findMany: mocks.findUsers, findUnique: mocks.findUser, update: mocks.updateUser },
  session: { deleteMany: mocks.deleteSessions }, supportTicket: { findMany: mocks.findTickets, findUnique: mocks.findTicket, update: mocks.updateTicket },
  edgeGateway: { findMany: mocks.findGateways }, solarForecastRun: { findMany: mocks.findForecasts }, weatherObservation: { findFirst: mocks.findWeather },
  weatherForecastRun: { findFirst: mocks.findWeatherForecast }, telemetryReading: { findFirst: mocks.findTelemetry }, adminAuditLog: { findMany: mocks.findAudits, create: mocks.createAudit }, $transaction: mocks.transaction,
} }));

import { AdminDomainError, getAdminConsoleView, updateAdminSupportTicket, updateAdminUserStatus } from "@/lib/admin/admin-service";

const admin = { id: "admin-1", role: "ADMIN" as const };
const user = { id: "user-1", name: "Aelora User", email: "user@aelora.local", role: "USER", status: "ACTIVE", createdAt: new Date("2026-08-01T00:00:00Z"), _count: { ownedSites: 1, sessions: 2 } };
const ticket = { id: "ticket-1", category: "TECHNICAL", priority: "NORMAL", status: "OPEN", subject: "Gateway help", message: "The gateway has stopped publishing telemetry.", adminResponse: null, respondedAt: null, resolvedAt: null, createdAt: new Date("2026-08-22T09:00:00Z"), updatedAt: new Date("2026-08-22T09:00:00Z"), user: { id: "user-1", name: "Aelora User", email: "user@aelora.local" }, site: { id: "site-1", name: "Colombo Home" } };

describe("admin service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUsers.mockResolvedValue([user]); mocks.findUser.mockResolvedValue(user); mocks.findTickets.mockResolvedValue([ticket]); mocks.findTicket.mockResolvedValue(ticket);
    mocks.findGateways.mockResolvedValue([{ id: "gw-1", name: "Virtual plant", mode: "VIRTUAL", status: "ONLINE", expectedIntervalSec: 30, lastSeenAt: new Date("2026-08-22T09:59:30Z"), lastTelemetryAt: new Date("2026-08-22T09:59:30Z"), softwareVersion: "0.2.0", site: { id: "site-1", name: "Colombo Home" } }]);
    mocks.findForecasts.mockResolvedValue([
      { modelName: "rf-unisolar", modelFamily: "RandomForest", modelStatus: "inactive_candidate", artifactSha256: "a".repeat(64), featureSchemaVersion: "1.0", productionActivationAllowed: false, createdAt: new Date("2026-08-22T09:30:00Z"), site: { name: "Colombo Home" } },
      { modelName: "rf-unisolar", modelFamily: "RandomForest", modelStatus: "inactive_candidate", artifactSha256: "a".repeat(64), featureSchemaVersion: "1.0", productionActivationAllowed: false, createdAt: new Date("2026-08-21T09:30:00Z"), site: { name: "Colombo Home" } },
    ]);
    mocks.findWeather.mockResolvedValue({ observedAt: new Date("2026-08-22T09:45:00Z"), fetchedAt: new Date("2026-08-22T09:46:00Z") });
    mocks.findWeatherForecast.mockResolvedValue({ fetchedAt: new Date("2026-08-22T09:40:00Z") }); mocks.findTelemetry.mockResolvedValue({ observedAt: new Date("2026-08-22T09:59:30Z"), source: "SIMULATOR" });
    mocks.findAudits.mockResolvedValue([]); mocks.updateUser.mockResolvedValue({ ...user, status: "DISABLED" }); mocks.deleteSessions.mockResolvedValue({ count: 2 });
    mocks.updateTicket.mockResolvedValue({ ...ticket, status: "RESOLVED", adminResponse: "Publishing recovered.", respondedAt: new Date("2026-08-22T10:00:00Z"), resolvedAt: new Date("2026-08-22T10:00:00Z") });
    mocks.createAudit.mockResolvedValue({ id: "audit-1" }); mocks.transaction.mockImplementation(async (callback) => callback({ user: { update: mocks.updateUser }, session: { deleteMany: mocks.deleteSessions }, supportTicket: { update: mocks.updateTicket }, adminAuditLog: { create: mocks.createAudit } }));
  });

  it("aggregates platform health, unique model artifacts, virtual gateways, users, tickets, and audit evidence", async () => {
    const view = await getAdminConsoleView("admin-1", new Date("2026-08-22T10:00:00Z"));
    expect(view.summary).toMatchObject({ users: 1, openTickets: 1, onlineGateways: 1, modelArtifacts: 1 });
    expect(view.models).toHaveLength(1);
    expect(view.health.telemetry).toMatchObject({ state: "FRESH", source: "SIMULATOR" });
    expect(view.gateways[0]).toMatchObject({ mode: "VIRTUAL", freshness: "FRESH" });
  });

  it("disables another user, revokes their sessions, and writes an audit record atomically", async () => {
    await updateAdminUserStatus(admin, "user-1", { status: "DISABLED" }, new Date("2026-08-22T10:00:00Z"));
    expect(mocks.deleteSessions).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: "admin-1", targetUserId: "user-1", action: "USER_STATUS_CHANGED" }) }));
  });

  it("prevents an administrator from disabling their current account", async () => {
    await expect(updateAdminUserStatus(admin, "admin-1", { status: "DISABLED" })).rejects.toEqual(expect.objectContaining<Partial<AdminDomainError>>({ code: "SELF_DISABLE_FORBIDDEN" }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("responds to and resolves a ticket with an audit record", async () => {
    const result = await updateAdminSupportTicket(admin, "ticket-1", { status: "RESOLVED", response: "Publishing recovered." }, new Date("2026-08-22T10:00:00Z"));
    expect(mocks.updateTicket).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED", adminResponse: "Publishing recovered.", resolvedAt: new Date("2026-08-22T10:00:00Z") }) }));
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supportTicketId: "ticket-1", action: "SUPPORT_TICKET_UPDATED" }) }));
    expect(result.status).toBe("RESOLVED");
  });

  it("reports missing, stale, and offline evidence without inventing health", async () => {
    mocks.findUsers.mockResolvedValue([{ ...user, status: "DISABLED" }]);
    mocks.findTickets.mockResolvedValue([{ ...ticket, status: "IN_PROGRESS" }, { ...ticket, id: "resolved", status: "RESOLVED" }]);
    mocks.findGateways.mockResolvedValue([
      { id: "never", name: "Never enrolled", mode: "VIRTUAL", status: "PENDING", expectedIntervalSec: 30, lastSeenAt: null, lastTelemetryAt: null, softwareVersion: null, site: { id: "site-1", name: "Colombo Home" } },
      { id: "stale", name: "Stale gateway", mode: "HARDWARE", status: "STALE", expectedIntervalSec: 30, lastSeenAt: new Date("2026-08-22T09:57:00Z"), lastTelemetryAt: null, softwareVersion: null, site: { id: "site-1", name: "Colombo Home" } },
      { id: "offline", name: "Offline gateway", mode: "VIRTUAL", status: "OFFLINE", expectedIntervalSec: 30, lastSeenAt: new Date("2026-08-22T09:30:00Z"), lastTelemetryAt: null, softwareVersion: null, site: { id: "site-1", name: "Colombo Home" } },
    ]);
    mocks.findForecasts.mockResolvedValue([]); mocks.findWeather.mockResolvedValue({ observedAt: new Date(), fetchedAt: new Date("2026-08-22T05:00:00Z") });
    mocks.findWeatherForecast.mockResolvedValue(null); mocks.findTelemetry.mockResolvedValue({ observedAt: new Date("2026-08-22T09:40:00Z"), source: "HARDWARE" });
    const view = await getAdminConsoleView("admin-1", new Date("2026-08-22T10:00:00Z"));
    expect(view.summary).toMatchObject({ activeUsers: 0, openTickets: 1, onlineGateways: 0, modelArtifacts: 0 });
    expect(view.gateways.map((gateway) => gateway.freshness)).toEqual(["NEVER_SEEN", "STALE", "OFFLINE"]);
    expect(view.health).toMatchObject({ telemetry: { state: "STALE" }, weather: { state: "STALE" }, weatherForecast: { state: "MISSING" }, solarForecast: { state: "MISSING" } });
  });

  it("activates a user without deleting sessions and rejects a missing target", async () => {
    mocks.findUser.mockResolvedValueOnce({ ...user, status: "DISABLED" });
    mocks.updateUser.mockResolvedValueOnce({ ...user, status: "ACTIVE" });
    await updateAdminUserStatus(admin, "user-1", { status: "ACTIVE" });
    expect(mocks.deleteSessions).not.toHaveBeenCalled();

    mocks.findUser.mockResolvedValueOnce(null);
    await expect(updateAdminUserStatus(admin, "missing", { status: "ACTIVE" })).rejects.toEqual(expect.objectContaining<Partial<AdminDomainError>>({ code: "TARGET_NOT_FOUND" }));
  });

  it("moves a ticket into progress without a response and rejects a missing ticket", async () => {
    mocks.updateTicket.mockResolvedValueOnce({ ...ticket, status: "IN_PROGRESS", adminResponse: null, respondedAt: null, resolvedAt: null });
    const changed = await updateAdminSupportTicket(admin, "ticket-1", { status: "IN_PROGRESS", response: null });
    expect(changed).toMatchObject({ status: "IN_PROGRESS", adminResponse: null, respondedAt: null, resolvedAt: null });

    mocks.findTicket.mockResolvedValueOnce(null);
    await expect(updateAdminSupportTicket(admin, "missing", { status: "OPEN", response: null })).rejects.toEqual(expect.objectContaining<Partial<AdminDomainError>>({ code: "TICKET_NOT_FOUND" }));
  });
});
