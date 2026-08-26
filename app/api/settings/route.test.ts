import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/settings/settings-service", () => ({
  updateUserSettings: mocks.update,
  SettingsDomainError: class SettingsDomainError extends Error { constructor(public code: string) { super(code); } },
}));

import { PUT } from "@/app/api/settings/route";

const validBody = { name: "Nimal Perera", username: "nimal.solar", theme: "DARK", timezone: "Asia/Colombo", measurementSystem: "METRIC", emailNotifications: true, defaultSiteId: "site-1" };

describe("settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.update.mockResolvedValue({ profile: { name: "Nimal Perera" }, preferences: validBody });
  });

  it("updates only the authenticated user's settings without caching", async () => {
    const response = await PUT(new Request("http://localhost/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.update).toHaveBeenCalledWith("user-1", validBody);
  });

  it("rejects invalid input before persistence", async () => {
    const response = await PUT(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify({ ...validBody, timezone: "Mars/Olympus" }) }));
    expect(response.status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await PUT(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify(validBody) }));
    expect(response.status).toBe(401);
  });

  it("returns a conflict when the username is already in use", async () => {
    const { SettingsDomainError } = await import("@/lib/settings/settings-service");
    mocks.update.mockRejectedValue(new SettingsDomainError("USERNAME_TAKEN"));

    const response = await PUT(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify(validBody) }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "username_taken" } });
  });
});
