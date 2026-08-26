import "server-only";

import { db } from "@/lib/db";
import { supportTicketCreateSchema, type SupportTicketCreate } from "@/lib/support/support";

export class SupportDomainError extends Error {
  constructor(public code: "USER_NOT_FOUND" | "SITE_NOT_FOUND") { super(code); }
}

export type SupportTicketView = {
  id: string;
  category: "TECHNICAL" | "ACCOUNT" | "DATA_FORECAST" | "FEATURE_REQUEST";
  priority: "NORMAL" | "HIGH";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  subject: string;
  message: string;
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string;
  site: { id: string; name: string } | null;
};

export type SupportView = {
  user: { name: string; email: string };
  sites: Array<{ id: string; name: string }>;
  tickets: SupportTicketView[];
};

const ticketSelect = { id: true, category: true, priority: true, status: true, subject: true, message: true, adminResponse: true, createdAt: true, updatedAt: true, site: { select: { id: true, name: true } } } as const;

function serializeTicket(ticket: {
  id: string; category: SupportTicketView["category"]; priority: SupportTicketView["priority"]; status: SupportTicketView["status"];
  subject: string; message: string; adminResponse: string | null; createdAt: Date; updatedAt: Date; site: { id: string; name: string } | null;
}): SupportTicketView {
  return { ...ticket, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString() };
}

export async function getSupportView(userId: string): Promise<SupportView> {
  const [user, sites, tickets] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    db.solarSite.findMany({ where: { ownerId: userId, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.supportTicket.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 20, select: ticketSelect }),
  ]);
  if (!user) throw new SupportDomainError("USER_NOT_FOUND");
  return { user: { name: user.name, email: user.email }, sites, tickets: tickets.map(serializeTicket) };
}

export async function createSupportTicket(userId: string, input: SupportTicketCreate): Promise<SupportTicketView> {
  const ticket = supportTicketCreateSchema.parse(input);
  if (ticket.siteId) {
    const site = await db.solarSite.findFirst({ where: { id: ticket.siteId, ownerId: userId, deletedAt: null }, select: { id: true } });
    if (!site) throw new SupportDomainError("SITE_NOT_FOUND");
  }
  const created = await db.supportTicket.create({
    data: { userId, siteId: ticket.siteId, category: ticket.category, priority: ticket.priority, subject: ticket.subject, message: ticket.message, status: "OPEN" },
    select: ticketSelect,
  });
  return serializeTicket(created);
}
