import { describe, expect, it } from "vitest";

import {
  canAccessSite,
  isAdmin,
  normalizeUserRole,
} from "@/lib/auth/authorization";

describe("role authorization", () => {
  it("recognizes only the configured admin role", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
    expect(isAdmin({ role: "USER" })).toBe(false);
    expect(isAdmin({ role: "unexpected" })).toBe(false);
  });

  it("falls back to USER for missing or invalid persisted roles", () => {
    expect(normalizeUserRole(undefined)).toBe("USER");
    expect(normalizeUserRole("owner")).toBe("USER");
  });
});

describe("site ownership authorization", () => {
  it("allows a user to access their own site", () => {
    expect(canAccessSite({ id: "user-1", role: "USER" }, "user-1")).toBe(true);
  });

  it("denies a user access to another owner's site", () => {
    expect(canAccessSite({ id: "user-1", role: "USER" }, "user-2")).toBe(false);
  });

  it("allows an administrator to access a site for audited operations", () => {
    expect(canAccessSite({ id: "admin-1", role: "ADMIN" }, "user-2")).toBe(true);
  });
});
