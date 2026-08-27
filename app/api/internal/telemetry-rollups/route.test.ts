import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), run: vi.fn() }));
vi.mock("@/lib/weather/sync-auth", () => ({ isWeatherSyncAuthorized: mocks.authorized }));
vi.mock("@/lib/telemetry/rollup-service", () => ({ runIncrementalTelemetryRollups: mocks.run }));

import { POST } from "@/app/api/internal/telemetry-rollups/route";

describe("POST /api/internal/telemetry-rollups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorized.mockReturnValue(true);
    mocks.run.mockResolvedValue({ attempted: 2, completed: 2, failed: 0, results: [] });
  });

  it("requires the private scheduler bearer secret", async () => {
    mocks.authorized.mockReturnValue(false);
    const response = await POST(new Request("http://localhost/api/internal/telemetry-rollups", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs the fail-isolated incremental worker without caching the result", async () => {
    const response = await POST(new Request("http://localhost/api/internal/telemetry-rollups", { method: "POST", headers: { authorization: "Bearer scheduler-secret" } }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.authorized).toHaveBeenCalledWith("Bearer scheduler-secret");
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });
});
