import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  getSiteForecastEvaluation,
  refreshSiteForecastVerification,
  VerificationDomainError,
} from "@/lib/forecast/verification-service";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: noStoreHeaders },
  );
}

async function actor() {
  const user = await getCurrentUser();
  return user ? { id: user.id, role: user.role } : null;
}

function verificationError(error: unknown) {
  if (error instanceof VerificationDomainError) {
    return errorResponse("site_not_found", "Solar site was not found.", 404);
  }
  console.error("Unexpected forecast verification failure", error);
  return errorResponse("internal_error", "Forecast verification could not be completed.", 500);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const currentActor = await actor();
  if (!currentActor) return errorResponse("unauthorized", "Authentication is required.", 401);
  const { siteId } = await params;
  try {
    return NextResponse.json(
      { data: await getSiteForecastEvaluation(currentActor, siteId) },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return verificationError(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const currentActor = await actor();
  if (!currentActor) return errorResponse("unauthorized", "Authentication is required.", 401);
  const { siteId } = await params;
  try {
    const refresh = await refreshSiteForecastVerification(currentActor, siteId);
    const evaluation = await getSiteForecastEvaluation(currentActor, siteId);
    return NextResponse.json(
      { data: { refresh, evaluation } },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return verificationError(error);
  }
}
