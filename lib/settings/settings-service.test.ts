import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findUsername: vi.fn(),
  findSite: vi.fn(),
  updateUser: vi.fn(),
  upsertPreference: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.findUser, findFirst: mocks.findUsername, update: mocks.updateUser },
    solarSite: { findFirst: mocks.findSite },
    userPreference: { upsert: mocks.upsertPreference },
    $transaction: mocks.transaction,
  },
}));

import { getSettingsView, SettingsDomainError, updateUserSettings } from "@/lib/settings/settings-service";

const userRecord = {
  id: "user-1",
  name: "Aelora User",
  username: "aelora-user",
  email: "user@aelora.local",
  image: null,
  role: "USER",
  preference: null,
  ownedSites: [{ id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo", status: "ACTIVE" }],
  sessions: [
    { id: "session-current", createdAt: new Date("2026-08-22T07:00:00Z"), updatedAt: new Date("2026-08-22T08:00:00Z"), expiresAt: new Date("2026-08-29T07:00:00Z"), ipAddress: "127.0.0.1", userAgent: "Chrome on Windows" },
  ],
};

const update = {
  name: "Nimal Perera",
  username: "nimal.solar",
  theme: "LIGHT" as const,
  timezone: "Asia/Colombo",
  measurementSystem: "METRIC" as const,
  emailNotifications: false,
  defaultSiteId: "site-1",
};

describe("settings service ownership and persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue(userRecord);
    mocks.findUsername.mockResolvedValue(null);
    mocks.findSite.mockResolvedValue({ id: "site-1" });
    mocks.updateUser.mockResolvedValue({ id: "user-1", name: update.name, username: update.username, email: userRecord.email, image: null, role: "USER" });
    mocks.upsertPreference.mockResolvedValue({ ...update, userId: "user-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({ user: { update: mocks.updateUser }, userPreference: { upsert: mocks.upsertPreference } }));
  });

  it("builds a safe view with defaults and identifies only the current session", async () => {
    const view = await getSettingsView("user-1", "session-current", new Date("2026-08-22T09:00:00Z"));

    expect(view.preferences).toEqual({ theme: "SYSTEM", timezone: "Asia/Colombo", measurementSystem: "METRIC", emailNotifications: true, defaultSiteId: "site-1" });
    expect(view.profile.username).toBe("aelora-user");
    expect(view.sessions[0]).toMatchObject({ id: "session-current", isCurrent: true, ipAddress: "127.0.0.1" });
    expect(view.sessions[0]).not.toHaveProperty("token");
  });

  it("updates the authenticated user's profile and preferences atomically", async () => {
    await updateUserSettings("user-1", update);

    expect(mocks.findSite).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "site-1", ownerId: "user-1", deletedAt: null } }));
    expect(mocks.findUsername).toHaveBeenCalledWith(expect.objectContaining({ where: { username: "nimal.solar", NOT: { id: "user-1" } } }));
    expect(mocks.updateUser).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" }, data: { name: "Nimal Perera", username: "nimal.solar" } }));
    expect(mocks.upsertPreference).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" }, create: expect.objectContaining({ userId: "user-1", theme: "LIGHT" }) }));
  });

  it("rejects another user's site before opening a transaction", async () => {
    mocks.findSite.mockResolvedValue(null);

    await expect(updateUserSettings("user-1", update)).rejects.toEqual(expect.objectContaining<Partial<SettingsDomainError>>({ code: "DEFAULT_SITE_NOT_FOUND" }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a username already owned by another account", async () => {
    mocks.findUsername.mockResolvedValue({ id: "user-2" });

    await expect(updateUserSettings("user-1", update)).rejects.toEqual(expect.objectContaining<Partial<SettingsDomainError>>({ code: "USERNAME_TAKEN" }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("translates a concurrent database username conflict", async () => {
    mocks.transaction.mockRejectedValue({ code: "P2002", meta: { target: ["username"] } });

    await expect(updateUserSettings("user-1", update)).rejects.toEqual(expect.objectContaining<Partial<SettingsDomainError>>({ code: "USERNAME_TAKEN" }));
  });

  it("returns a not-found boundary for a missing account", async () => {
    mocks.findUser.mockResolvedValue(null);
    await expect(getSettingsView("missing", null)).rejects.toEqual(expect.objectContaining<Partial<SettingsDomainError>>({ code: "USER_NOT_FOUND" }));
  });
});
