-- CreateEnum
CREATE TYPE "GatewayMode" AS ENUM ('VIRTUAL', 'HARDWARE');

-- CreateEnum
CREATE TYPE "GatewayStatus" AS ENUM ('PENDING', 'ONLINE', 'DEGRADED', 'STALE', 'OFFLINE', 'REVOKED');

-- CreateEnum
CREATE TYPE "GatewayDeviceKind" AS ENUM ('PV_ARRAY', 'INVERTER', 'BATTERY', 'GRID_METER', 'LOAD_METER', 'WEATHER_SENSOR');

-- CreateEnum
CREATE TYPE "DeviceConnectivityStatus" AS ENUM ('NEVER_SEEN', 'ONLINE', 'STALE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "DeviceOperationalState" AS ENUM ('UNKNOWN', 'RUNNING', 'STANDBY', 'STOPPED', 'FAULT');

-- CreateEnum
CREATE TYPE "TelemetryBatchStatus" AS ENUM ('ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "TelemetryReading" ADD COLUMN "gatewayId" TEXT,
ADD COLUMN "telemetryBatchId" TEXT;

-- CreateTable
CREATE TABLE "EdgeGateway" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gatewayUid" TEXT NOT NULL,
    "mode" "GatewayMode" NOT NULL,
    "status" "GatewayStatus" NOT NULL DEFAULT 'PENDING',
    "credentialHash" TEXT,
    "enrollmentTokenHash" TEXT,
    "enrollmentExpiresAt" TIMESTAMP(3),
    "expectedIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "lastSequence" INTEGER,
    "softwareVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EdgeGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayDevice" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" "GatewayDeviceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "connectivityStatus" "DeviceConnectivityStatus" NOT NULL DEFAULT 'NEVER_SEEN',
    "operationalState" "DeviceOperationalState" NOT NULL DEFAULT 'UNKNOWN',
    "expectedIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "lastSeenAt" TIMESTAMP(3),
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GatewayDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryBatch" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "GatewayMode" NOT NULL,
    "status" "TelemetryBatchStatus" NOT NULL DEFAULT 'ACCEPTED',
    CONSTRAINT "TelemetryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceObservation" (
    "id" TEXT NOT NULL,
    "telemetryBatchId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "lastTelemetryAt" TIMESTAMP(3),
    "quality" "TelemetryQuality" NOT NULL,
    "connectivityStatus" "DeviceConnectivityStatus" NOT NULL,
    "operationalState" "DeviceOperationalState" NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EdgeGateway_gatewayUid_key" ON "EdgeGateway"("gatewayUid");
CREATE UNIQUE INDEX "EdgeGateway_credentialHash_key" ON "EdgeGateway"("credentialHash");
CREATE UNIQUE INDEX "EdgeGateway_enrollmentTokenHash_key" ON "EdgeGateway"("enrollmentTokenHash");
CREATE INDEX "EdgeGateway_siteId_status_idx" ON "EdgeGateway"("siteId", "status");
CREATE INDEX "EdgeGateway_siteId_createdAt_idx" ON "EdgeGateway"("siteId", "createdAt");
CREATE INDEX "GatewayDevice_gatewayId_connectivityStatus_idx" ON "GatewayDevice"("gatewayId", "connectivityStatus");
CREATE INDEX "GatewayDevice_serialNumber_idx" ON "GatewayDevice"("serialNumber");
CREATE UNIQUE INDEX "GatewayDevice_gatewayId_externalId_key" ON "GatewayDevice"("gatewayId", "externalId");
CREATE INDEX "TelemetryBatch_gatewayId_receivedAt_idx" ON "TelemetryBatch"("gatewayId", "receivedAt" DESC);
CREATE UNIQUE INDEX "TelemetryBatch_gatewayId_batchId_key" ON "TelemetryBatch"("gatewayId", "batchId");
CREATE UNIQUE INDEX "TelemetryBatch_gatewayId_sequence_key" ON "TelemetryBatch"("gatewayId", "sequence");
CREATE INDEX "DeviceObservation_deviceId_reportedAt_idx" ON "DeviceObservation"("deviceId", "reportedAt" DESC);
CREATE UNIQUE INDEX "DeviceObservation_telemetryBatchId_deviceId_key" ON "DeviceObservation"("telemetryBatchId", "deviceId");
CREATE UNIQUE INDEX "TelemetryReading_telemetryBatchId_key" ON "TelemetryReading"("telemetryBatchId");
CREATE INDEX "TelemetryReading_gatewayId_observedAt_idx" ON "TelemetryReading"("gatewayId", "observedAt" DESC);

ALTER TABLE "TelemetryReading" ADD CONSTRAINT "TelemetryReading_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "EdgeGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemetryReading" ADD CONSTRAINT "TelemetryReading_telemetryBatchId_fkey" FOREIGN KEY ("telemetryBatchId") REFERENCES "TelemetryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EdgeGateway" ADD CONSTRAINT "EdgeGateway_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SolarSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewayDevice" ADD CONSTRAINT "GatewayDevice_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "EdgeGateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemetryBatch" ADD CONSTRAINT "TelemetryBatch_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "EdgeGateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceObservation" ADD CONSTRAINT "DeviceObservation_telemetryBatchId_fkey" FOREIGN KEY ("telemetryBatchId") REFERENCES "TelemetryBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceObservation" ADD CONSTRAINT "DeviceObservation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "GatewayDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
