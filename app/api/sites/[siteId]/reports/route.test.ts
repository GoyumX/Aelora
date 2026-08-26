import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/reports/report-service", () => ({
  generateReportSnapshot: mocks.generate,
  ReportDomainError: class ReportDomainError extends Error { constructor(public code: string) { super(code); } },
}));

import { POST } from "@/app/api/sites/[siteId]/reports/route";

const context = { params: Promise.resolve({ siteId: "site-1" }) };

describe("report generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.generate.mockResolvedValue({ id: "report-1" });
  });

  it("validates and creates an owner-scoped report without caching", async () => {
    const response = await POST(new Request("http://localhost/api/sites/site-1/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "WEEKLY", from: "2026-08-10", to: "2026-08-17" }) }), context);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.generate).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "site-1", { type: "WEEKLY", from: "2026-08-10", to: "2026-08-17" });
  });

  it("rejects malformed periods before querying report evidence", async () => {
    const response = await POST(new Request("http://localhost/api/sites/site-1/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "WEEKLY", from: "2026-08-10", to: "2026-08-12" }) }), context);

    expect(response.status).toBe(422);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/sites/site-1/reports", { method: "POST", body: "{}" }), context);
    expect(response.status).toBe(401);
  });
});
