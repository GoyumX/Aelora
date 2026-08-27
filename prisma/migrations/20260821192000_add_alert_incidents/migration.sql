-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('GRID_OUTAGE', 'GATEWAY_OFFLINE', 'DEVICE_OFFLINE', 'INVERTER_FAULT', 'BATTERY_LOW', 'PV_UNDERPERFORMANCE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AlertEvidenceQuality" AS ENUM ('SIMULATED', 'MEASURED', 'MIXED');

-- CreateTable
CREATE TABLE "AlertIncident" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "openKey" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceQuality" "AlertEvidenceQuality" NOT NULL,
    "evidence" JSONB NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertIncident_openKey_key" ON "AlertIncident"("openKey");

-- CreateIndex
CREATE INDEX "AlertIncident_siteId_status_lastDetectedAt_idx" ON "AlertIncident"("siteId", "status", "lastDetectedAt" DESC);

-- CreateIndex
CREATE INDEX "AlertIncident_siteId_type_firstDetectedAt_idx" ON "AlertIncident"("siteId", "type", "firstDetectedAt" DESC);

-- CreateIndex
CREATE INDEX "AlertIncident_siteId_severity_status_idx" ON "AlertIncident"("siteId", "severity", "status");

-- AddForeignKey
ALTER TABLE "AlertIncident" ADD CONSTRAINT "AlertIncident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
