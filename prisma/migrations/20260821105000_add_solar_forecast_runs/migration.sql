-- CreateEnum
CREATE TYPE "SolarForecastSource" AS ENUM ('MODEL');

-- CreateTable
CREATE TABLE "SolarForecastRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "weatherForecastRunId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "installedCapacityKwp" DOUBLE PRECISION NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelFamily" TEXT NOT NULL,
    "modelStatus" TEXT NOT NULL,
    "artifactSha256" TEXT NOT NULL,
    "featureSchemaVersion" TEXT NOT NULL,
    "productionActivationAllowed" BOOLEAN NOT NULL DEFAULT false,
    "estimatedEnergyKwh" DOUBLE PRECISION NOT NULL,
    "daylightHours" INTEGER NOT NULL,
    "limitations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolarForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarForecastPoint" (
    "id" TEXT NOT NULL,
    "solarForecastRunId" TEXT NOT NULL,
    "validAt" TIMESTAMP(3) NOT NULL,
    "leadHours" DOUBLE PRECISION NOT NULL,
    "capacityFactor" DOUBLE PRECISION NOT NULL,
    "estimatedPowerKw" DOUBLE PRECISION NOT NULL,
    "estimatedEnergyKwh" DOUBLE PRECISION NOT NULL,
    "source" "SolarForecastSource" NOT NULL DEFAULT 'MODEL',

    CONSTRAINT "SolarForecastPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolarForecastRun_requestId_key" ON "SolarForecastRun"("requestId");

-- CreateIndex
CREATE INDEX "SolarForecastRun_siteId_createdAt_idx" ON "SolarForecastRun"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SolarForecastRun_weatherForecastRunId_idx" ON "SolarForecastRun"("weatherForecastRunId");

-- CreateIndex
CREATE UNIQUE INDEX "SolarForecastPoint_solarForecastRunId_validAt_key" ON "SolarForecastPoint"("solarForecastRunId", "validAt");

-- CreateIndex
CREATE INDEX "SolarForecastPoint_validAt_idx" ON "SolarForecastPoint"("validAt");

-- AddForeignKey
ALTER TABLE "SolarForecastRun" ADD CONSTRAINT "SolarForecastRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarForecastRun" ADD CONSTRAINT "SolarForecastRun_weatherForecastRunId_fkey" FOREIGN KEY ("weatherForecastRunId") REFERENCES "WeatherForecastRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarForecastPoint" ADD CONSTRAINT "SolarForecastPoint_solarForecastRunId_fkey" FOREIGN KEY ("solarForecastRunId") REFERENCES "SolarForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
