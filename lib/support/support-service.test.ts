import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUser: vi.fn(), findSites: vi.fn(), findTickets: vi.fn(), findSite: vi.fn(), createTicket: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: mocks.findUser },
  solarSite: { findMany: mocks.findSites, findFirst: mocks.findSite },
  supportTicket: { findMany: mocks.findTickets, create: mocks.createTicket },
} }));

import { createSupportTicket, getSupportView, SupportDomainError } from "@/lib/support/support-service";

const ticketRecord = {
  id: "ticket-1", category: "TECHNICAL", priority: "NORMAL", status: "OPEN", subject: "Gateway stopped publishing",
  message: "My virtual gateway has not published data for the last ten minutes.", adminResponse: null, createdAt: new Date("2026-08-22T09:00:00Z"), updatedAt: new Date("2026-08-22T09:00:00Z"), site: { id: "site-1", name: "Colombo Home" },
};

describe("support service ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({ id: "user-1", name: "Aelora User", email: "user@aelora.local" });
    mocks.findSites.mockResolvedValue([{ id: "site-1", name: "Colombo Home" }]);
    mocks.findTickets.mockResolvedValue([ticketRecord]);
    mocks.findSite.mockResolvedValue({ id: "site-1" });
    mocks.createTicket.mockResolvedValue(ticketRecord);
  });

  it("lists only tickets belonging to the authenticated user", async () => {
    const view = await getSupportView("user-1");
    expect(mocks.findTickets).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    expect(view.tickets[0]).toMatchObject({ id: "ticket-1", site: { name: "Colombo Home" } });
  });

  it("creates a ticket linked only to an owned site", async () => {
    await createSupportTicket("user-1", { category: "TECHNICAL", priority: "NORMAL", subject: ticketRecord.subject, message: ticketRecord.message, siteId: "site-1" });
    expect(mocks.findSite).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "site-1", ownerId: "user-1", deletedAt: null } }));
    expect(mocks.createTicket).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", siteId: "site-1", status: "OPEN" }) }));
  });

  it("rejects another user's site before creating a ticket", async () => {
    mocks.findSite.mockResolvedValue(null);
    await expect(createSupportTicket("user-1", { category: "TECHNICAL", priority: "NORMAL", subject: ticketRecord.subject, message: ticketRecord.message, siteId: "foreign-site" })).rejects.toEqual(expect.objectContaining<Partial<SupportDomainError>>({ code: "SITE_NOT_FOUND" }));
    expect(mocks.createTicket).not.toHaveBeenCalled();
  });

  it("returns a not-found boundary for a missing account", async () => {
    mocks.findUser.mockResolvedValue(null);
    await expect(getSupportView("missing")).rejects.toEqual(expect.objectContaining<Partial<SupportDomainError>>({ code: "USER_NOT_FOUND" }));
  });
});
