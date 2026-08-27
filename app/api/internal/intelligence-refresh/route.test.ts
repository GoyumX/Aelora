import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), weather: vi.fn(), forecast: vi.fn() }));
vi.mock("@/lib/weather/sync-auth", () => ({ isWeatherSyncAuthorized: mocks.authorized }));
vi.mock("@/lib/weather/weather-service", () => ({ syncAllActiveSiteWeather: mocks.weather }));
vi.mock("@/lib/forecast/forecast-service", () => ({ refreshAllStaleSiteForecasts: mocks.forecast }));

import { POST } from "@/app/api/internal/intelligence-refresh/route";

describe("POST /api/internal/intelligence-refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorized.mockReturnValue(true);
    mocks.weather.mockResolvedValue({ synced: 1, skipped: 0, failed: 0 });
    mocks.forecast.mockResolvedValue({ generated: 1, skipped: 0, failed: 0 });
  });

  it("stores weather before rerunning stale forecasts", async () => {
    const response = await POST(new Request("http://localhost/api/internal/intelligence-refresh", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.weather.mock.invocationCallOrder[0]).toBeLessThan(mocks.forecast.mock.invocationCallOrder[0]);
    await expect(response.json()).resolves.toMatchObject({ data: { weather: { synced: 1 }, forecast: { generated: 1 } } });
  });

  it("rejects a missing scheduler secret without doing work", async () => {
    mocks.authorized.mockReturnValue(false);
    const response = await POST(new Request("http://localhost/api/internal/intelligence-refresh", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.weather).not.toHaveBeenCalled();
    expect(mocks.forecast).not.toHaveBeenCalled();
  });
});
