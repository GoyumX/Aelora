import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/forecast/forecast-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/forecast/forecast-service")>()),
  generateSiteForecast: mocks.generate,
}));

import { ForecastDomainError } from "@/lib/forecast/forecast-service";
import { POST } from "@/app/api/sites/[siteId]/forecast/route";

describe("POST /api/sites/:siteId/forecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.generate.mockResolvedValue({ id: "forecast-1", requestId: "request-1" });
  });

  it("requires an authenticated session", async () => {
    mocks.currentUser.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("generates an owner-scoped forecast and disables response caching", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.generate).toHaveBeenCalledWith(
      { id: "user-1", role: "USER" },
      "site-1",
    );
  });

  it("maps missing weather to a safe conflict response", async () => {
    mocks.generate.mockRejectedValue(new ForecastDomainError("weather_unavailable"));

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "weather_unavailable" },
    });
  });
});
