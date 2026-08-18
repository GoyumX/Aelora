import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createGatewaySecret(purpose: "enroll" | "credential") {
  return `aelora_${purpose}_${randomBytes(32).toString("base64url")}`;
}

export function hashGatewaySecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function readBearerToken(authorization: string | null) {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

type GatewayCredentialRecord = {
  credentialHash: string | null;
  pendingCredentialHash: string | null;
  pendingCredentialExpiresAt: Date | null;
};

function hashesEqual(first: string | null, second: string) {
  if (!first) return false;
  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

export function matchGatewayCredential(
  record: GatewayCredentialRecord,
  credential: string,
  now = new Date(),
): "current" | "pending" | null {
  const candidateHash = hashGatewaySecret(credential);
  if (hashesEqual(record.credentialHash, candidateHash)) return "current";
  if (
    record.pendingCredentialExpiresAt
    && record.pendingCredentialExpiresAt > now
    && hashesEqual(record.pendingCredentialHash, candidateHash)
  ) return "pending";
  return null;
}
