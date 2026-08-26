-- Step 30 expand phase: add summary tables without changing or deleting raw telemetry.
CREATE TABLE "TelemetryRollup15Minute" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "bucketEnd" TIMESTAMP(3) NOT NULL,
    "generationWh" INTEGER NOT NULL,
    "consumptionWh" INTEGER NOT NULL,
    "importWh" INTEGER NOT NULL,
    "exportWh" INTEGER NOT NULL,
    "batteryChargeWh" INTEGER NOT NULL,
    "batteryDischargeWh" INTEGER NOT NULL,
    "averagePvPowerW" INTEGER NOT NULL,
    "peakPvPowerW" INTEGER NOT NULL,
    "averageLoadPowerW" INTEGER NOT NULL,
    "peakLoadPowerW" INTEGER NOT NULL,
    "averageIrradianceWm2" INTEGER NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "expectedSampleCount" INTEGER NOT NULL,
    "expectedIntervalSec" INTEGER NOT NULL,
    "coveredDurationSec" INTEGER NOT NULL,
    "coveragePct" DOUBLE PRECISION NOT NULL,
    "maxGapSec" INTEGER NOT NULL,
    "evidenceQuality" "ForecastActualQuality" NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL,
    "lastObservedAt" TIMESTAMP(3) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelemetryRollup15Minute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TelemetryRollup15Minute_bucket_order_check" CHECK ("bucketEnd" > "bucketStart"),
    CONSTRAINT "TelemetryRollup15Minute_coverage_check" CHECK ("coveragePct" >= 0 AND "coveragePct" <= 100),
    CONSTRAINT "TelemetryRollup15Minute_duration_check" CHECK ("coveredDurationSec" >= 0 AND "coveredDurationSec" <= 900)
);

CREATE TABLE "TelemetryRollupDaily" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "dayStartAt" TIMESTAMP(3) NOT NULL,
    "dayEndAt" TIMESTAMP(3) NOT NULL,
    "generationWh" INTEGER NOT NULL,
    "consumptionWh" INTEGER NOT NULL,
    "importWh" INTEGER NOT NULL,
    "exportWh" INTEGER NOT NULL,
    "batteryChargeWh" INTEGER NOT NULL,
    "batteryDischargeWh" INTEGER NOT NULL,
    "averagePvPowerW" INTEGER NOT NULL,
    "peakPvPowerW" INTEGER NOT NULL,
    "averageLoadPowerW" INTEGER NOT NULL,
    "peakLoadPowerW" INTEGER NOT NULL,
    "averageIrradianceWm2" INTEGER NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "completeIntervalCount" INTEGER NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "expectedSampleCount" INTEGER NOT NULL,
    "expectedIntervalSec" INTEGER NOT NULL,
    "coveredDurationSec" INTEGER NOT NULL,
    "coveragePct" DOUBLE PRECISION NOT NULL,
    "maxGapSec" INTEGER NOT NULL,
    "evidenceQuality" "ForecastActualQuality" NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL,
    "lastObservedAt" TIMESTAMP(3) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelemetryRollupDaily_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TelemetryRollupDaily_day_order_check" CHECK ("dayEndAt" > "dayStartAt"),
    CONSTRAINT "TelemetryRollupDaily_coverage_check" CHECK ("coveragePct" >= 0 AND "coveragePct" <= 100),
    CONSTRAINT "TelemetryRollupDaily_interval_count_check" CHECK ("completeIntervalCount" <= "intervalCount")
);

CREATE UNIQUE INDEX "TelemetryRollup15Minute_siteId_bucketStart_key" ON "TelemetryRollup15Minute"("siteId", "bucketStart");
CREATE INDEX "TelemetryRollup15Minute_siteId_bucketStart_idx" ON "TelemetryRollup15Minute"("siteId", "bucketStart" DESC);
CREATE INDEX "TelemetryRollup15Minute_siteId_coveragePct_bucketStart_idx" ON "TelemetryRollup15Minute"("siteId", "coveragePct", "bucketStart" DESC);
CREATE UNIQUE INDEX "TelemetryRollupDaily_siteId_localDate_key" ON "TelemetryRollupDaily"("siteId", "localDate");
CREATE INDEX "TelemetryRollupDaily_siteId_localDate_idx" ON "TelemetryRollupDaily"("siteId", "localDate" DESC);
CREATE INDEX "TelemetryRollupDaily_siteId_coveragePct_localDate_idx" ON "TelemetryRollupDaily"("siteId", "coveragePct", "localDate" DESC);

ALTER TABLE "TelemetryRollup15Minute" ADD CONSTRAINT "TelemetryRollup15Minute_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemetryRollupDaily" ADD CONSTRAINT "TelemetryRollupDaily_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
