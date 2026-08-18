import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createGatewaySecret, hashGatewaySecret } from "@/lib/gateway/credentials";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; gatewayId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Authentication is required." } }, { status: 401 });
  }

  const { siteId, gatewayId } = await params;
  const gateway = await db.edgeGateway.findFirst({
    where: {
      id: gatewayId,
      siteId,
      site: { deletedAt: null, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
    },
    select: { id: true, revokedAt: true, credentialVersion: true, enrolledAt: true },
  });
  if (!gateway) {
    return NextResponse.json({ error: { code: "not_found", message: "Gateway was not found." } }, { status: 404 });
  }
  if (gateway.revokedAt || !gateway.enrolledAt) {
    return NextResponse.json(
      { error: { code: "invalid_gateway_state", message: "Only an enrolled, active gateway can rotate credentials." } },
      { status: 409 },
    );
  }

  const credential = createGatewaySecret("credential");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.edgeGateway.update({
    where: { id: gateway.id },
    data: {
      pendingCredentialHash: hashGatewaySecret(credential),
      pendingCredentialExpiresAt: expiresAt,
    },
  });

  return NextResponse.json(
    { data: { credential, expiresAt: expiresAt.toISOString(), credentialVersion: gateway.credentialVersion + 1 } },
    {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store",
        Location: `/api/sites/${siteId}/gateways/${gatewayId}/credential-rotations/current`,
      },
    },
  );
}
