import { describe, expect, it } from "vitest";

import { passwordChangeSchema, settingsUpdateSchema } from "@/lib/settings/settings";

const validSettings = {
  name: "Nimal Perera",
  username: "nimal.solar",
  theme: "DARK",
  timezone: "Asia/Colombo",
  measurementSystem: "METRIC",
  emailNotifications: true,
  defaultSiteId: "site-1",
};

describe("settings validation", () => {
  it("normalizes a valid profile and preference update", () => {
    expect(settingsUpdateSchema.parse({ ...validSettings, name: "  Nimal Perera  ", username: "  Nimal.Solar  " })).toEqual(validSettings);
  });

  it("accepts an unset username and rejects unsafe usernames", () => {
    expect(settingsUpdateSchema.parse({ ...validSettings, username: null }).username).toBeNull();
    expect(settingsUpdateSchema.safeParse({ ...validSettings, username: "no spaces allowed" }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...validSettings, username: "ab" }).success).toBe(false);
  });

  it("rejects an unsupported timezone and an empty profile name", () => {
    expect(settingsUpdateSchema.safeParse({ ...validSettings, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...validSettings, name: " " }).success).toBe(false);
  });

  it("accepts no default site and rejects malformed site identifiers", () => {
    expect(settingsUpdateSchema.parse({ ...validSettings, defaultSiteId: null }).defaultSiteId).toBeNull();
    expect(settingsUpdateSchema.safeParse({ ...validSettings, defaultSiteId: "" }).success).toBe(false);
  });

  it("requires a strong new password that differs from the current password", () => {
    expect(passwordChangeSchema.safeParse({ currentPassword: "OldPassword1!", newPassword: "NewPassword2!" }).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ currentPassword: "SamePassword1!", newPassword: "SamePassword1!" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: "OldPassword1!", newPassword: "short" }).success).toBe(false);
  });
});
