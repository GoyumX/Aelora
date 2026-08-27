import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthorized: vi.fn(),
  syncAll: vi.fn(),
}));

vi.mock("@/lib/weather/sync-auth", () => ({ isWeatherSyncAuthorized: mocks.isAuthorized }));
vi.mock("@/lib/weather/weather-service", () => ({ syncAllActiveSiteWeather: mocks.syncAll }));

import { POST } from "@/app/api/internal/weather-sync/route";

describe("POST /api/internal/weather-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthorized.mockReturnValue(true);
    mocks.syncAll.mockResolvedValue({ attempted: 2, synced: 2, failed: 0, results: [] });
  });

  it("rejects an invalid scheduler credential", async () => {
    mocks.isAuthorized.mockReturnValue(false);
    const response = await POST(new NextRequest("http://localhost/api/internal/weather-sync", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(mocks.syncAll).not.toHaveBeenCalled();
  });

  it("syncs every active site for an authorized scheduler", async () => {
    const request = new NextRequest("http://localhost/api/internal/weather-sync", {
      method: "POST",
      headers: { Authorization: "Bearer weather-secret" },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.isAuthorized).toHaveBeenCalledWith("Bearer weather-secret");
    expect(await response.json()).toEqual({ data: { attempted: 2, synced: 2, failed: 0, results: [] } });
  });
});
