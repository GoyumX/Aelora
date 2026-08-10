CREATE TYPE "TelemetrySource" AS ENUM ('SIMULATOR', 'HARDWARE');
CREATE TYPE "TelemetryQuality" AS ENUM ('SIMULATED', 'MEASURED', 'ESTIMATED', 'STALE', 'MISSING');

CREATE TABLE "TelemetryReading" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" "TelemetrySource" NOT NULL,
    "quality" "TelemetryQuality" NOT NULL,
    "pvPowerW" INTEGER NOT NULL,
    "pvEnergyTodayWh" INTEGER NOT NULL,
    "loadPowerW" INTEGER NOT NULL,
    "gridPowerW" INTEGER NOT NULL,
    "batteryPowerW" INTEGER NOT NULL,
    "batterySocPct" INTEGER NOT NULL,
    "dcVoltageV" DOUBLE PRECISION NOT NULL,
    "dcCurrentA" DOUBLE PRECISION NOT NULL,
    "acVoltageV" DOUBLE PRECISION NOT NULL,
    "acCurrentA" DOUBLE PRECISION NOT NULL,
    "gridVoltageV" DOUBLE PRECISION NOT NULL,
    "frequencyHz" DOUBLE PRECISION NOT NULL,
    "inverterTemperatureC" DOUBLE PRECISION NOT NULL,
    "panelTemperatureC" DOUBLE PRECISION NOT NULL,
    "irradianceWm2" INTEGER NOT NULL,
    "deviceStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetryReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelemetryReading_siteId_source_observedAt_key" ON "TelemetryReading"("siteId", "source", "observedAt");
CREATE INDEX "TelemetryReading_siteId_observedAt_idx" ON "TelemetryReading"("siteId", "observedAt" DESC);
ALTER TABLE "TelemetryReading" ADD CONSTRAINT "TelemetryReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
