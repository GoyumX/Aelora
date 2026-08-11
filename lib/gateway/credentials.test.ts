import { describe, expect, it } from "vitest";

import {
  createGatewaySecret,
  hashGatewaySecret,
  matchGatewayCredential,
  readBearerToken,
} from "@/lib/gateway/credentials";

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

  it("accepts the current or unexpired pending rotation without exposing either secret", () => {
    const current = "aelora_credential_current-secret-value";
    const pending = "aelora_credential_pending-secret-value";
    const record = {
      credentialHash: hashGatewaySecret(current),
      pendingCredentialHash: hashGatewaySecret(pending),
      pendingCredentialExpiresAt: new Date("2026-08-11T11:00:00.000Z"),
    };

    expect(matchGatewayCredential(record, current, new Date("2026-08-11T10:30:00.000Z"))).toBe("current");
    expect(matchGatewayCredential(record, pending, new Date("2026-08-11T10:30:00.000Z"))).toBe("pending");
    expect(matchGatewayCredential(record, pending, new Date("2026-08-11T11:00:01.000Z"))).toBeNull();
    expect(matchGatewayCredential(record, "wrong-secret", new Date("2026-08-11T10:30:00.000Z"))).toBeNull();
  });
});
