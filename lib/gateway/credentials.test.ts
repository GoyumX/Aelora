import { describe, expect, it } from "vitest";

import { createGatewaySecret, hashGatewaySecret, readBearerToken } from "@/lib/gateway/credentials";

describe("gateway credentials", () => {
  it("creates a high-entropy secret and stores only its deterministic hash", () => {
    const secret = createGatewaySecret("enroll");
    const hash = hashGatewaySecret(secret);

    expect(secret).toMatch(/^aelora_enroll_[A-Za-z0-9_-]{40,}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashGatewaySecret(secret));
    expect(hash).not.toContain(secret);
  });

  it("accepts only a non-empty bearer token", () => {
    expect(readBearerToken("Bearer gateway-secret")).toBe("gateway-secret");
    expect(readBearerToken("Basic abc123")).toBeNull();
    expect(readBearerToken("Bearer ")).toBeNull();
    expect(readBearerToken(null)).toBeNull();
  });
});
