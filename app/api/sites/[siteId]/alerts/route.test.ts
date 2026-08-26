import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getView: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/alerts/alert-service", () => ({
  getSiteAlertsView: mocks.getView,
  refreshSiteAlerts: mocks.refresh,
  AlertDomainError: class AlertDomainError extends Error {
    constructor(public code: string) { super(code); }
  },
}));

import { GET, POST } from "@/app/api/sites/[siteId]/alerts/route";

const context = { params: Promise.resolve({ siteId: "site-1" }) };

describe("site alerts route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.getView.mockResolvedValue({ site: { id: "site-1" }, incidents: [] });
    mocks.refresh.mockResolvedValue({ created: 1, updated: 0, resolved: 0 });
  });

  it("returns owner-scoped incidents without caching", async () => {
    const response = await GET(new Request("http://localhost/api/sites/site-1/alerts"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getView).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "site-1");
  });

  it("evaluates current evidence and returns the refreshed view", async () => {
    const response = await POST(new Request("http://localhost/api/sites/site-1/alerts", { method: "POST" }), context);

    expect(response.status).toBe(200);
    expect(mocks.refresh).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "site-1");
    expect(await response.json()).toMatchObject({ data: { refresh: { created: 1 }, view: { site: { id: "site-1" } } } });
  });

  it("requires an authenticated user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/sites/site-1/alerts"), context);

    expect(response.status).toBe(401);
    expect(mocks.getView).not.toHaveBeenCalled();
  });
});
