import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { reportPeriodRequestSchema } from "@/lib/reports/report";
import { generateReportSnapshot, ReportDomainError } from "@/lib/reports/report-service";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders });
}

function reportError(error: unknown) {
  if (error instanceof ReportDomainError && error.code === "SITE_NOT_FOUND") return errorResponse("site_not_found", "Solar site was not found.", 404);
  if (error instanceof ReportDomainError && error.code === "INVALID_PERIOD") return errorResponse("invalid_period", "The report period is invalid.", 422);
  console.error("Unexpected report generation failure", error);
  return errorResponse("internal_error", "The report could not be generated.", 500);
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("invalid_json", "A valid JSON body is required.", 400); }
  const parsed = reportPeriodRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("invalid_period", parsed.error.issues[0]?.message ?? "The report period is invalid.", 422);
  const { siteId } = await params;
  try {
    const report = await generateReportSnapshot(user, siteId, parsed.data);
    return NextResponse.json({ data: report }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    return reportError(error);
  }
}
