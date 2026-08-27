import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: mocks.query } }));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue([{ ok: 1 }]);
  });

  it("reports readiness only after PostgreSQL responds", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "ok",
      checks: { database: "ok" },
    });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("returns 503 without exposing the database error", async () => {
    mocks.query.mockRejectedValue(new Error("postgres password=do-not-leak"));

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('"database":"unavailable"');
    expect(body).not.toContain("password");
    expect(body).not.toContain("do-not-leak");
  });
});
