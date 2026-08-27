import "server-only";

import type { Prisma } from "@prisma/client";

import { adminTicketUpdateSchema, adminUserStatusSchema, type AdminTicketUpdateInput, type AdminUserStatusInput } from "@/lib/admin/admin";
import type { UserRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

type AdminActor = { id: string; role: UserRole };
type FreshnessState = "FRESH" | "STALE" | "MISSING";

export class AdminDomainError extends Error {
  constructor(public code: "TARGET_NOT_FOUND" | "TICKET_NOT_FOUND" | "SELF_DISABLE_FORBIDDEN") { super(code); }
}

export type AdminUserView = { id: string; name: string; email: string; role: "USER" | "ADMIN"; status: "ACTIVE" | "DISABLED"; createdAt: string; siteCount: number; sessionCount: number };
export type AdminTicketView = { id: string; category: "TECHNICAL" | "ACCOUNT" | "DATA_FORECAST" | "FEATURE_REQUEST"; priority: "NORMAL" | "HIGH"; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; subject: string; message: string; adminResponse: string | null; respondedAt: string | null; resolvedAt: string | null; createdAt: string; updatedAt: string; user: { id: string; name: string; email: string }; site: { id: string; name: string } | null };
export type AdminConsoleView = {
  generatedAt: string; currentAdminId: string;
  summary: { users: number; activeUsers: number; openTickets: number; onlineGateways: number; modelArtifacts: number };
  health: { database: { state: "HEALTHY"; detail: string }; telemetry: { state: FreshnessState; at: string | null; source: string | null }; weather: { state: FreshnessState; at: string | null }; weatherForecast: { state: FreshnessState; at: string | null }; solarForecast: { state: FreshnessState; at: string | null } };
  users: AdminUserView[]; tickets: AdminTicketView[];
  gateways: Array<{ id: string; name: string; mode: "VIRTUAL" | "HARDWARE"; status: string; freshness: "FRESH" | "STALE" | "OFFLINE" | "NEVER_SEEN"; expectedIntervalSec: number; lastSeenAt: string | null; lastTelemetryAt: string | null; softwareVersion: string | null; site: { id: string; name: string } }>;
  models: Array<{ modelName: string; modelFamily: string; modelStatus: string; artifactSha256: string; featureSchemaVersion: string; productionActivationAllowed: boolean; lastUsedAt: string; siteName: string }>;
  audits: Array<{ id: string; action: "USER_STATUS_CHANGED" | "SUPPORT_TICKET_UPDATED"; summary: string; createdAt: string; actor: { name: string; email: string } | null; targetUser: { name: string; email: string } | null; supportTicket: { id: string; subject: string } | null }>;
};

const userSelect = { id: true, name: true, email: true, role: true, status: true, createdAt: true, _count: { select: { ownedSites: true, sessions: true } } } as const;
const ticketSelect = { id: true, category: true, priority: true, status: true, subject: true, message: true, adminResponse: true, respondedAt: true, resolvedAt: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, email: true } }, site: { select: { id: true, name: true } } } as const;

function serializeUser(user: { id: string; name: string; email: string; role: "USER" | "ADMIN"; status: "ACTIVE" | "DISABLED"; createdAt: Date; _count: { ownedSites: number; sessions: number } }): AdminUserView { return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, createdAt: user.createdAt.toISOString(), siteCount: user._count.ownedSites, sessionCount: user._count.sessions }; }
function serializeTicket(ticket: { id: string; category: AdminTicketView["category"]; priority: AdminTicketView["priority"]; status: AdminTicketView["status"]; subject: string; message: string; adminResponse: string | null; respondedAt: Date | null; resolvedAt: Date | null; createdAt: Date; updatedAt: Date; user: AdminTicketView["user"]; site: AdminTicketView["site"] }): AdminTicketView { return { ...ticket, respondedAt: ticket.respondedAt?.toISOString() ?? null, resolvedAt: ticket.resolvedAt?.toISOString() ?? null, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString() }; }

function freshness(at: Date | null | undefined, now: Date, freshMs: number, staleMs: number): FreshnessState { if (!at) return "MISSING"; const age = now.getTime() - at.getTime(); return age <= freshMs ? "FRESH" : age <= staleMs ? "STALE" : "MISSING"; }
function gatewayFreshness(at: Date | null, expectedIntervalSec: number, now: Date) { if (!at) return "NEVER_SEEN" as const; const ageSec = (now.getTime() - at.getTime()) / 1000; if (ageSec <= expectedIntervalSec * 2) return "FRESH" as const; if (ageSec <= expectedIntervalSec * 10) return "STALE" as const; return "OFFLINE" as const; }

export async function getAdminConsoleView(currentAdminId: string, now = new Date()): Promise<AdminConsoleView> {
  const [users, tickets, gateways, forecastRuns, weather, weatherForecast, telemetry, audits] = await Promise.all([
    db.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: userSelect }),
    db.supportTicket.findMany({ orderBy: { updatedAt: "desc" }, take: 30, select: ticketSelect }),
    db.edgeGateway.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, mode: true, status: true, expectedIntervalSec: true, lastSeenAt: true, lastTelemetryAt: true, softwareVersion: true, site: { select: { id: true, name: true } } } }),
    db.solarForecastRun.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { modelName: true, modelFamily: true, modelStatus: true, artifactSha256: true, featureSchemaVersion: true, productionActivationAllowed: true, createdAt: true, site: { select: { name: true } } } }),
    db.weatherObservation.findFirst({ orderBy: { fetchedAt: "desc" }, select: { observedAt: true, fetchedAt: true } }),
    db.weatherForecastRun.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    db.telemetryReading.findFirst({ orderBy: { observedAt: "desc" }, select: { observedAt: true, source: true } }),
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, action: true, summary: true, createdAt: true, actor: { select: { name: true, email: true } }, targetUser: { select: { name: true, email: true } }, supportTicket: { select: { id: true, subject: true } } } }),
  ]);
  const modelMap = new Map<string, AdminConsoleView["models"][number]>();
  for (const run of forecastRuns) if (!modelMap.has(run.artifactSha256)) modelMap.set(run.artifactSha256, { modelName: run.modelName, modelFamily: run.modelFamily, modelStatus: run.modelStatus, artifactSha256: run.artifactSha256, featureSchemaVersion: run.featureSchemaVersion, productionActivationAllowed: run.productionActivationAllowed, lastUsedAt: run.createdAt.toISOString(), siteName: run.site.name });
  const gatewayViews = gateways.map((gateway) => ({ ...gateway, status: gateway.status, freshness: gatewayFreshness(gateway.lastSeenAt, gateway.expectedIntervalSec, now), lastSeenAt: gateway.lastSeenAt?.toISOString() ?? null, lastTelemetryAt: gateway.lastTelemetryAt?.toISOString() ?? null }));
  const modelArtifacts = [...modelMap.values()];
  return {
    generatedAt: now.toISOString(), currentAdminId,
    summary: { users: users.length, activeUsers: users.filter((user) => user.status === "ACTIVE").length, openTickets: tickets.filter((ticket) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS").length, onlineGateways: gatewayViews.filter((gateway) => gateway.freshness === "FRESH").length, modelArtifacts: modelArtifacts.length },
    health: { database: { state: "HEALTHY", detail: "PostgreSQL query completed" }, telemetry: { state: freshness(telemetry?.observedAt, now, 5 * 60_000, 30 * 60_000), at: telemetry?.observedAt.toISOString() ?? null, source: telemetry?.source ?? null }, weather: { state: freshness(weather?.fetchedAt, now, 2 * 3_600_000, 6 * 3_600_000), at: weather?.fetchedAt.toISOString() ?? null }, weatherForecast: { state: freshness(weatherForecast?.fetchedAt, now, 6 * 3_600_000, 12 * 3_600_000), at: weatherForecast?.fetchedAt.toISOString() ?? null }, solarForecast: { state: freshness(forecastRuns[0]?.createdAt, now, 6 * 3_600_000, 12 * 3_600_000), at: forecastRuns[0]?.createdAt.toISOString() ?? null } },
    users: users.map(serializeUser), tickets: tickets.map(serializeTicket), gateways: gatewayViews, models: modelArtifacts,
    audits: audits.map((audit) => ({ ...audit, createdAt: audit.createdAt.toISOString() })),
  };
}

export async function updateAdminUserStatus(actor: AdminActor, targetUserId: string, input: AdminUserStatusInput, now = new Date()): Promise<AdminUserView> {
  const update = adminUserStatusSchema.parse(input);
  if (actor.id === targetUserId && update.status === "DISABLED") throw new AdminDomainError("SELF_DISABLE_FORBIDDEN");
  const target = await db.user.findUnique({ where: { id: targetUserId, deletedAt: null }, select: { id: true, status: true } });
  if (!target) throw new AdminDomainError("TARGET_NOT_FOUND");
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const changed = await tx.user.update({ where: { id: targetUserId }, data: { status: update.status }, select: userSelect });
    if (update.status === "DISABLED") await tx.session.deleteMany({ where: { userId: targetUserId } });
    await tx.adminAuditLog.create({ data: { actorId: actor.id, targetUserId, action: "USER_STATUS_CHANGED", summary: `${changed.email} changed from ${target.status} to ${update.status}`, metadata: { from: target.status, to: update.status, occurredAt: now.toISOString() } } });
    return serializeUser(changed);
  });
}

export async function updateAdminSupportTicket(actor: AdminActor, ticketId: string, input: AdminTicketUpdateInput, now = new Date()): Promise<AdminTicketView> {
  const update = adminTicketUpdateSchema.parse(input);
  const existing = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, status: true, subject: true } });
  if (!existing) throw new AdminDomainError("TICKET_NOT_FOUND");
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const ticket = await tx.supportTicket.update({ where: { id: ticketId }, data: { status: update.status, adminResponse: update.response, respondedAt: update.response ? now : null, resolvedAt: update.status === "RESOLVED" || update.status === "CLOSED" ? now : null }, select: ticketSelect });
    await tx.adminAuditLog.create({ data: { actorId: actor.id, supportTicketId: ticketId, targetUserId: ticket.user.id, action: "SUPPORT_TICKET_UPDATED", summary: `${existing.subject} changed from ${existing.status} to ${update.status}`, metadata: { from: existing.status, to: update.status, responded: Boolean(update.response), occurredAt: now.toISOString() } } });
    return serializeTicket(ticket);
  });
}
