import "server-only";

import { db } from "@/lib/db";
import { hashGatewaySecret, matchGatewayCredential } from "@/lib/gateway/credentials";

export async function authenticateGateway(gatewayId: string, credential: string, now = new Date()) {
  const gateway = await db.edgeGateway.findUnique({
    where: { id: gatewayId },
    select: {
      id: true,
      siteId: true,
      mode: true,
      expectedIntervalSec: true,
      credentialHash: true,
      pendingCredentialHash: true,
      pendingCredentialExpiresAt: true,
      credentialVersion: true,
      revokedAt: true,
    },
  });
  if (!gateway || gateway.revokedAt) return null;

  const match = matchGatewayCredential(gateway, credential, now);
  if (!match) return null;

  if (match === "pending") {
    const pendingCredentialHash = hashGatewaySecret(credential);
    const promoted = await db.edgeGateway.updateMany({
      where: {
        id: gateway.id,
        revokedAt: null,
        pendingCredentialHash,
        pendingCredentialExpiresAt: { gt: now },
      },
      data: {
        credentialHash: pendingCredentialHash,
        pendingCredentialHash: null,
        pendingCredentialExpiresAt: null,
        credentialVersion: { increment: 1 },
        credentialRotatedAt: now,
      },
    });
    if (promoted.count !== 1) return null;
  }

  return {
    id: gateway.id,
    siteId: gateway.siteId,
    mode: gateway.mode,
    expectedIntervalSec: gateway.expectedIntervalSec,
    credentialVersion: gateway.credentialVersion + (match === "pending" ? 1 : 0),
  };
}
