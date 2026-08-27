-- Support report-to-user relation lookups and efficient user deletion checks.
CREATE INDEX "ReportSnapshot_generatedById_idx" ON "ReportSnapshot"("generatedById");
