ALTER TABLE "SolarForecastRun"
ADD COLUMN "estimatedLoadEnergyKwh" DOUBLE PRECISION,
ADD COLUMN "loadForecastMethod" TEXT;

ALTER TABLE "SolarForecastPoint"
ADD COLUMN "estimatedLoadPowerKw" DOUBLE PRECISION,
ADD COLUMN "estimatedLoadEnergyKwh" DOUBLE PRECISION;
