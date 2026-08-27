import { describe, expect, it } from "vitest";

import { getRouteRedirect } from "@/lib/auth/route-access";

describe("getRouteRedirect", () => {
  it("allows guests to access public routes without a redirect loop", () => {
    expect(getRouteRedirect("/", null)).toBeNull();
    expect(getRouteRedirect("/sign-in", null)).toBeNull();
    expect(getRouteRedirect("/sign-up", null)).toBeNull();
    expect(getRouteRedirect("/forgot-password", null)).toBeNull();
  });

  it("sends guests to sign in while retaining a safe destination", () => {
    expect(getRouteRedirect("/reports", null)).toBe("/sign-in?callbackUrl=%2Freports");
  });

  it("denies the admin area to regular users", () => {
    expect(getRouteRedirect("/admin", "USER")).toBe("/dashboard");
  });

  it("allows administrators into the admin area", () => {
    expect(getRouteRedirect("/admin", "ADMIN")).toBeNull();
  });

  it("allows authenticated users into their application", () => {
    expect(getRouteRedirect("/dashboard", "USER")).toBeNull();
  });
});
