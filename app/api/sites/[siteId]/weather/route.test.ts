import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findSite: vi.fn(),
  syncSiteWeather: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/configuration/site-access", () => ({ findConfigurableSite: mocks.findSite }));
vi.mock("@/lib/weather/weather-service", () => ({
  getLatestSiteWeather: vi.fn(),
  syncSiteWeather: mocks.syncSiteWeather,
}));

import { POST } from "@/app/api/sites/[siteId]/weather/route";

describe("POST /api/sites/:siteId/weather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.findSite.mockResolvedValue({ id: "site-1" });
    mocks.syncSiteWeather.mockResolvedValue({ synced: true, pointCount: 168 });
  });

  it("refreshes weather only after the owner boundary succeeds", async () => {
    const response = await POST(new Request("http://localhost/api/sites/site-1/weather", { method: "POST" }), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.findSite).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "site-1");
    expect(mocks.syncSiteWeather).toHaveBeenCalledWith("site-1");
  });

  it("does not call the provider for another user's site", async () => {
    mocks.findSite.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/sites/site-2/weather", { method: "POST" }), {
      params: Promise.resolve({ siteId: "site-2" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.syncSiteWeather).not.toHaveBeenCalled();
  });
});
