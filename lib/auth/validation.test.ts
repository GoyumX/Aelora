import { describe, expect, it } from "vitest";

import {
  getSafeCallbackUrl,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/validation";

describe("authentication validation", () => {
  it("normalizes a valid sign-in request", () => {
    expect(
      signInSchema.parse({
        email: "  USER@Example.com ",
        password: "valid-password",
      }),
    ).toEqual({ email: "user@example.com", password: "valid-password" });
  });

  it("rejects weak registration passwords", () => {
    const result = signUpSchema.safeParse({
      name: "Solar User",
      email: "solar@example.com",
      password: "password",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a strong registration request", () => {
    expect(
      signUpSchema.safeParse({
        name: "Solar User",
        email: "solar@example.com",
        password: "SolarPower42",
      }).success,
    ).toBe(true);
  });
});

describe("getSafeCallbackUrl", () => {
  it("keeps an internal application path", () => {
    expect(getSafeCallbackUrl("/reports?period=month")).toBe(
      "/reports?period=month",
    );
  });

  it.each(["https://attacker.example", "//attacker.example", "javascript:alert(1)"])(
    "rejects the unsafe callback %s",
    (callbackUrl) => {
      expect(getSafeCallbackUrl(callbackUrl)).toBe("/dashboard");
    },
  );
});
