import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("security headers", () => {
  it("protects every route against framing, MIME sniffing, and broad device access", async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(
      rules?.flatMap((rule) => rule.headers.map((header) => [header.key, header.value])),
    );

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});
