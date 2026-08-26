import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/alerts/alert-service", () => ({
  updateSiteAlert: mocks.update,
  AlertDomainError: class AlertDomainError extends Error {
    constructor(public code: string) { super(code); }
  },
}));

import { PATCH } from "@/app/api/sites/[siteId]/alerts/[alertId]/route";

const context = { params: Promise.resolve({ siteId: "site-1", alertId: "alert-1" }) };

describe("alert lifecycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.update.mockResolvedValue({ id: "alert-1", status: "ACKNOWLEDGED" });
  });

  it("acknowledges an owner-scoped open incident", async () => {
    const response = await PATCH(new Request("http://localhost/api/sites/site-1/alerts/alert-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "ACKNOWLEDGE" }),
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      { id: "user-1", role: "USER" },
      "site-1",
      "alert-1",
      "ACKNOWLEDGE",
    );
  });

  it("rejects unsupported lifecycle actions", async () => {
    const response = await PATCH(new Request("http://localhost/api/sites/site-1/alerts/alert-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "DELETE" }),
    }), context);

    expect(response.status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
