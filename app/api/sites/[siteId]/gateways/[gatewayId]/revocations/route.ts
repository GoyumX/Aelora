import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

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
    select: { id: true, revokedAt: true },
  });
  if (!gateway) {
    return NextResponse.json({ error: { code: "not_found", message: "Gateway was not found." } }, { status: 404 });
  }
  if (gateway.revokedAt) {
    return NextResponse.json({ data: { gatewayId, revoked: true, revokedAt: gateway.revokedAt.toISOString(), duplicate: true } });
  }

  const revokedAt = new Date();
  await db.edgeGateway.update({
    where: { id: gateway.id },
    data: {
      status: "REVOKED",
      revokedAt,
      credentialHash: null,
      pendingCredentialHash: null,
      pendingCredentialExpiresAt: null,
      enrollmentTokenHash: null,
      enrollmentExpiresAt: null,
    },
  });

  return NextResponse.json(
    { data: { gatewayId, revoked: true, revokedAt: revokedAt.toISOString(), duplicate: false } },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
