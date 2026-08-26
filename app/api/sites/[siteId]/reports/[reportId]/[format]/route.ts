import { getCurrentUser } from "@/lib/auth/session";
import { reportSnapshotToCsv } from "@/lib/reports/report";
import { reportSnapshotToPdf } from "@/lib/reports/report-pdf";
import { getReportSnapshot, ReportDomainError } from "@/lib/reports/report-service";

const noStoreHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers: noStoreHeaders });
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; reportId: string; format: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  const { siteId, reportId, format } = await params;
  if (format !== "csv" && format !== "pdf") return errorResponse("format_not_found", "The requested report format is not supported.", 404);
  try {
    const stored = await getReportSnapshot(user, siteId, reportId);
    const stem = `aelora-${stored.type.toLowerCase()}-${stored.payload.period.from.slice(0, 10)}`;
    if (format === "csv") {
      return new Response(reportSnapshotToCsv(stored.payload), { headers: { ...noStoreHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${stem}.csv"` } });
    }
    const pdf = await reportSnapshotToPdf(stored.payload);
    return new Response(new Uint8Array(pdf).buffer, { headers: { ...noStoreHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${stem}.pdf"` } });
  } catch (error) {
    if (error instanceof ReportDomainError && (error.code === "SITE_NOT_FOUND" || error.code === "REPORT_NOT_FOUND")) return errorResponse("report_not_found", "Report snapshot was not found.", 404);
    console.error("Unexpected report download failure", error);
    return errorResponse("internal_error", "The report could not be downloaded.", 500);
  }
}
