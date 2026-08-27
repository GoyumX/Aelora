import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, getSecurityHeaders } from "@/lib/security/headers";

function asRecord(production: boolean) {
  return Object.fromEntries(getSecurityHeaders(production).map(({ key, value }) => [key, value]));
}

describe("application security headers", () => {
  it("sets an explicit restrictive content policy and browser protections", () => {
    const headers = asRecord(false);
    const policy = buildContentSecurityPolicy("test-nonce", true);

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("enables HSTS only for a production HTTPS deployment", () => {
    expect(asRecord(false)["Strict-Transport-Security"]).toBeUndefined();
    expect(asRecord(true)["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
  });
});
