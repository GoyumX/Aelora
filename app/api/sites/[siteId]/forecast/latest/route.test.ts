import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  latest: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/forecast/forecast-service", () => ({
  getLatestSiteForecast: mocks.latest,
}));

import { GET } from "@/app/api/sites/[siteId]/forecast/latest/route";

describe("GET /api/sites/:siteId/forecast/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.latest.mockResolvedValue({ id: "forecast-1", requestId: "request-1" });
  });

  it("requires an authenticated session", async () => {
    mocks.currentUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.latest).not.toHaveBeenCalled();
  });

  it("returns only the latest owner-scoped stored DTO", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.latest).toHaveBeenCalledWith(
      { id: "user-1", role: "USER" },
      "site-1",
    );
  });

  it("uses not found for both missing and inaccessible forecasts", async () => {
    mocks.latest.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-2" }),
    });

    expect(response.status).toBe(404);
  });
});
