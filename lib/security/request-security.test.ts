import { describe, expect, it } from "vitest";

import {
  FixedWindowRateLimiter,
  inspectMutationRequest,
  resolveMutationPolicy,
} from "@/lib/security/request-security";

describe("shared API mutation security", () => {
  it("allows safe reads without applying mutation controls", () => {
    const request = new Request("https://aelora.example/api/settings", { method: "GET" });

    expect(inspectMutationRequest(request)).toEqual({ allowed: true, policy: null });
  });

  it("rejects a cross-site browser mutation before it reaches a route handler", () => {
    const request = new Request("https://aelora.example/api/settings", {
      method: "PUT",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
        "content-length": "128",
      },
    });

    expect(inspectMutationRequest(request)).toMatchObject({
      allowed: false,
      code: "cross_site_request",
      status: 403,
    });
  });

  it("allows a same-origin browser mutation", () => {
    const request = new Request("https://aelora.example/api/settings", {
      method: "PUT",
      headers: {
        origin: "https://aelora.example",
        "sec-fetch-site": "same-origin",
        "content-length": "128",
      },
    });

    expect(inspectMutationRequest(request)).toMatchObject({
      allowed: true,
      policy: { category: "browser", maxRequests: 60, bodyLimitBytes: 262_144 },
    });
  });

  it("does not apply browser-origin checks to authenticated gateway delivery", () => {
    const request = new Request(
      "https://aelora.example/api/v1/gateways/gateway-1/telemetry-batches",
      { method: "POST", headers: { "content-length": "1024" } },
    );

    expect(inspectMutationRequest(request)).toMatchObject({
      allowed: true,
      policy: { category: "gateway", maxRequests: 180, bodyLimitBytes: 2_097_152 },
    });
  });

  it("rejects a declared payload larger than its endpoint policy", () => {
    const request = new Request("https://aelora.example/api/support-tickets", {
      method: "POST",
      headers: {
        origin: "https://aelora.example",
        "content-length": "262145",
      },
    });

    expect(inspectMutationRequest(request)).toMatchObject({
      allowed: false,
      code: "payload_too_large",
      status: 413,
    });
  });

  it("leaves Better Auth mutation protection to Better Auth", () => {
    expect(resolveMutationPolicy("/api/auth/sign-in/email")).toBeNull();
  });
});

describe("fixed-window request throttling", () => {
  it("blocks requests over the limit and permits them after the window resets", () => {
    const limiter = new FixedWindowRateLimiter();

    expect(limiter.consume("browser:user-1", 2, 60_000, 1_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("browser:user-1", 2, 60_000, 1_500)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("browser:user-1", 2, 60_000, 2_000)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 59,
    });
    expect(limiter.consume("browser:user-1", 2, 60_000, 61_001)).toMatchObject({ allowed: true, remaining: 1 });
  });
});
