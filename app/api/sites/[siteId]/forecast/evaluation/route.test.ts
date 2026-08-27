import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getEvaluation: vi.fn(),
  refreshVerification: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/forecast/verification-service", () => ({
  getSiteForecastEvaluation: mocks.getEvaluation,
  refreshSiteForecastVerification: mocks.refreshVerification,
  VerificationDomainError: class VerificationDomainError extends Error {
    constructor(public code: string) { super(code); }
  },
}));

import { GET, POST } from "@/app/api/sites/[siteId]/forecast/evaluation/route";

const context = { params: Promise.resolve({ siteId: "site-1" }) };

describe("forecast evaluation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.getEvaluation.mockResolvedValue({ siteId: "site-1", overall: { sampleCount: 4 } });
    mocks.refreshVerification.mockResolvedValue({ considered: 4, persisted: 4, withheld: 0 });
  });

  it("returns an owner-scoped no-store evaluation", async () => {
    const response = await GET(new Request("http://localhost/api/sites/site-1/forecast/evaluation"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getEvaluation).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "site-1");
  });

  it("refreshes completed labels and returns the updated evaluation", async () => {
    const response = await POST(new Request("http://localhost/api/sites/site-1/forecast/evaluation", { method: "POST" }), context);

    expect(response.status).toBe(200);
    expect(mocks.refreshVerification).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "site-1");
    expect(await response.json()).toMatchObject({ data: { refresh: { persisted: 4 }, evaluation: { siteId: "site-1" } } });
  });

  it("requires authentication before evaluation access", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/sites/site-1/forecast/evaluation"), context);

    expect(response.status).toBe(401);
    expect(mocks.getEvaluation).not.toHaveBeenCalled();
  });
});
