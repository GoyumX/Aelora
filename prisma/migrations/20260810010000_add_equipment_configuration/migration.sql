CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED');

CREATE TABLE "SolarArray" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "panelCount" INTEGER NOT NULL,
    "ratedPowerW" INTEGER NOT NULL,
    "tiltDeg" DOUBLE PRECISION NOT NULL,
    "azimuthDeg" DOUBLE PRECISION NOT NULL,
    "installationDate" TIMESTAMP(3),
    "temperatureCoefficientPctC" DOUBLE PRECISION,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "SolarArray_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Inverter" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialAlias" TEXT,
    "acRatingW" INTEGER NOT NULL,
    "efficiencyPct" DOUBLE PRECISION NOT NULL,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "communicationAdapter" TEXT NOT NULL DEFAULT 'SIMULATOR',
    "pollingIntervalSec" INTEGER NOT NULL DEFAULT 15,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "Inverter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Battery" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "manufacturer" TEXT,
    "model" TEXT,
    "usableCapacityWh" INTEGER NOT NULL,
    "maxChargePowerW" INTEGER NOT NULL,
    "maxDischargePowerW" INTEGER NOT NULL,
    "minSocPct" INTEGER NOT NULL DEFAULT 10,
    "maxSocPct" INTEGER NOT NULL DEFAULT 95,
    "roundTripEfficiencyPct" DOUBLE PRECISION NOT NULL,
    "reservePct" INTEGER NOT NULL DEFAULT 20,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Battery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolarArray_siteId_name_key" ON "SolarArray"("siteId", "name");
CREATE INDEX "SolarArray_siteId_status_idx" ON "SolarArray"("siteId", "status");
CREATE INDEX "Inverter_siteId_status_idx" ON "Inverter"("siteId", "status");
CREATE UNIQUE INDEX "Battery_siteId_key" ON "Battery"("siteId");
CREATE INDEX "Battery_siteId_status_idx" ON "Battery"("siteId", "status");

ALTER TABLE "SolarArray" ADD CONSTRAINT "SolarArray_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inverter" ADD CONSTRAINT "Inverter_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Battery" ADD CONSTRAINT "Battery_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
