CREATE TYPE "ForecastActualQuality" AS ENUM ('SIMULATED', 'MEASURED', 'ESTIMATED', 'MIXED');

CREATE TABLE "SolarForecastVerification" (
    "id" TEXT NOT NULL,
    "solarForecastPointId" TEXT NOT NULL,
    "intervalStartAt" TIMESTAMP(3) NOT NULL,
    "intervalEndAt" TIMESTAMP(3) NOT NULL,
    "actualEnergyKwh" DOUBLE PRECISION NOT NULL,
    "errorKwh" DOUBLE PRECISION NOT NULL,
    "absoluteErrorKwh" DOUBLE PRECISION NOT NULL,
    "squaredErrorKwh2" DOUBLE PRECISION NOT NULL,
    "coveragePct" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "sampleIntervalSec" INTEGER NOT NULL,
    "actualQuality" "ForecastActualQuality" NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolarForecastVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolarForecastVerification_solarForecastPointId_key"
ON "SolarForecastVerification"("solarForecastPointId");

CREATE INDEX "SolarForecastVerification_verifiedAt_idx"
ON "SolarForecastVerification"("verifiedAt" DESC);

CREATE INDEX "SolarForecastVerification_actualQuality_verifiedAt_idx"
ON "SolarForecastVerification"("actualQuality", "verifiedAt" DESC);

ALTER TABLE "SolarForecastVerification"
ADD CONSTRAINT "SolarForecastVerification_solarForecastPointId_fkey"
FOREIGN KEY ("solarForecastPointId") REFERENCES "SolarForecastPoint"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
