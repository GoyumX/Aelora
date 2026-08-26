-- CreateEnum
CREATE TYPE "WeatherProvider" AS ENUM ('OPEN_METEO');

-- CreateTable
CREATE TABLE "WeatherObservation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "provider" "WeatherProvider" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "condition" TEXT NOT NULL,
    "temperatureAirC" DOUBLE PRECISION NOT NULL,
    "apparentTemperatureC" DOUBLE PRECISION,
    "relativeHumidityPct" INTEGER,
    "cloudCoverPct" INTEGER,
    "precipitationMm" DOUBLE PRECISION,
    "weatherCode" INTEGER NOT NULL,
    "windSpeedKmh" DOUBLE PRECISION,
    "windDirectionDeg" INTEGER,
    "shortwaveRadiationWm2" DOUBLE PRECISION,
    "directRadiationWm2" DOUBLE PRECISION,
    "diffuseRadiationWm2" DOUBLE PRECISION,
    "directNormalIrradianceWm2" DOUBLE PRECISION,
    "globalTiltedIrradianceWm2" DOUBLE PRECISION,
    "isDay" BOOLEAN,
    "raw" JSONB,

    CONSTRAINT "WeatherObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherForecastRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "provider" "WeatherProvider" NOT NULL,
    "modelSelection" TEXT NOT NULL DEFAULT 'best_match',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forecastDays" INTEGER NOT NULL,
    "requestLatitude" DOUBLE PRECISION NOT NULL,
    "requestLongitude" DOUBLE PRECISION NOT NULL,
    "requestTimezone" TEXT NOT NULL,
    "requestTiltDeg" DOUBLE PRECISION,
    "requestAzimuthDeg" DOUBLE PRECISION,
    "responseTimezone" TEXT,
    "responseUtcOffsetSeconds" INTEGER,
    "generationTimeMs" DOUBLE PRECISION,
    "attribution" TEXT NOT NULL DEFAULT 'Weather data by Open-Meteo.com',
    "rawMetadata" JSONB,

    CONSTRAINT "WeatherForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherForecastPoint" (
    "id" TEXT NOT NULL,
    "weatherForecastRunId" TEXT NOT NULL,
    "validAt" TIMESTAMP(3) NOT NULL,
    "condition" TEXT NOT NULL,
    "temperatureAirC" DOUBLE PRECISION,
    "relativeHumidityPct" INTEGER,
    "cloudCoverPct" INTEGER,
    "precipitationProbabilityPct" INTEGER,
    "precipitationMm" DOUBLE PRECISION,
    "windSpeedKmh" DOUBLE PRECISION,
    "weatherCode" INTEGER,
    "shortwaveRadiationWm2" DOUBLE PRECISION,
    "directRadiationWm2" DOUBLE PRECISION,
    "diffuseRadiationWm2" DOUBLE PRECISION,
    "directNormalIrradianceWm2" DOUBLE PRECISION,
    "globalTiltedIrradianceWm2" DOUBLE PRECISION,

    CONSTRAINT "WeatherForecastPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherObservation_siteId_provider_observedAt_key" ON "WeatherObservation"("siteId", "provider", "observedAt");

-- CreateIndex
CREATE INDEX "WeatherObservation_siteId_observedAt_idx" ON "WeatherObservation"("siteId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "WeatherObservation_siteId_provider_fetchedAt_idx" ON "WeatherObservation"("siteId", "provider", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "WeatherForecastRun_siteId_fetchedAt_idx" ON "WeatherForecastRun"("siteId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "WeatherForecastRun_siteId_provider_fetchedAt_idx" ON "WeatherForecastRun"("siteId", "provider", "fetchedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherForecastPoint_weatherForecastRunId_validAt_key" ON "WeatherForecastPoint"("weatherForecastRunId", "validAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherForecastRun_siteId_provider_fetchedAt_key" ON "WeatherForecastRun"("siteId", "provider", "fetchedAt");

-- CreateIndex
CREATE INDEX "WeatherForecastPoint_validAt_idx" ON "WeatherForecastPoint"("validAt");

-- AddForeignKey
ALTER TABLE "WeatherObservation" ADD CONSTRAINT "WeatherObservation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherForecastRun" ADD CONSTRAINT "WeatherForecastRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherForecastPoint" ADD CONSTRAINT "WeatherForecastPoint_weatherForecastRunId_fkey" FOREIGN KEY ("weatherForecastRunId") REFERENCES "WeatherForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
