import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/admin/admin-service", () => ({ updateAdminSupportTicket: mocks.update, AdminDomainError: class AdminDomainError extends Error { constructor(public code: string) { super(code); } } }));
import { PATCH } from "@/app/api/admin/support-tickets/[ticketId]/route";
const context = { params: Promise.resolve({ ticketId: "ticket-1" }) };
describe("admin support route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" }); mocks.update.mockResolvedValue({ id: "ticket-1", status: "RESOLVED", adminResponse: "Publishing recovered." }); });
  it("stores an administrator response and lifecycle state", async () => { const body = { status: "RESOLVED", response: "Publishing recovered." }; const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), context); expect(response.status).toBe(200); expect(mocks.update).toHaveBeenCalledWith({ id: "admin-1", role: "ADMIN" }, "ticket-1", body); });
  it("rejects unauthenticated access", async () => { mocks.getCurrentUser.mockResolvedValue(null); const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }), context); expect(response.status).toBe(401); });
  it("requires a response to resolve a ticket", async () => { const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "RESOLVED", response: null }) }), context); expect(response.status).toBe(422); expect(mocks.update).not.toHaveBeenCalled(); });
});
