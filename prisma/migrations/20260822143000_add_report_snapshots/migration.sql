-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "generatedById" TEXT,
    "type" "ReportType" NOT NULL,
    "periodStartAt" TIMESTAMP(3) NOT NULL,
    "periodEndAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schemaVersion" TEXT NOT NULL,
    "dataHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportSnapshot_siteId_type_periodStartAt_periodEndAt_dataHash_key" ON "ReportSnapshot"("siteId", "type", "periodStartAt", "periodEndAt", "dataHash");

-- CreateIndex
CREATE INDEX "ReportSnapshot_siteId_generatedAt_idx" ON "ReportSnapshot"("siteId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "ReportSnapshot_siteId_type_periodStartAt_idx" ON "ReportSnapshot"("siteId", "type", "periodStartAt" DESC);

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
