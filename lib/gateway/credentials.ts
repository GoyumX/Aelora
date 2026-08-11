import { createHash, randomBytes } from "node:crypto";

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
