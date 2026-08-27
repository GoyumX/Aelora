import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), createTicket: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/support/support-service", () => ({
  createSupportTicket: mocks.createTicket,
  SupportDomainError: class SupportDomainError extends Error { constructor(public code: string) { super(code); } },
}));

import { POST } from "@/app/api/support-tickets/route";

const validBody = { category: "TECHNICAL", priority: "NORMAL", subject: "Gateway stopped publishing", message: "My virtual gateway has not published data for the last ten minutes.", siteId: "site-1" };

describe("support ticket route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.createTicket.mockResolvedValue({ id: "ticket-1", ...validBody, status: "OPEN" });
  });

  it("creates an authenticated owner-scoped local ticket without caching", async () => {
    const response = await POST(new Request("http://localhost/api/support-tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody) }));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.createTicket).toHaveBeenCalledWith("user-1", validBody);
  });

  it("rejects invalid ticket content before persistence", async () => {
    const response = await POST(new Request("http://localhost/api/support-tickets", { method: "POST", body: JSON.stringify({ ...validBody, message: "short" }) }));
    expect(response.status).toBe(422);
    expect(mocks.createTicket).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/support-tickets", { method: "POST", body: JSON.stringify(validBody) }));
    expect(response.status).toBe(401);
  });
});
