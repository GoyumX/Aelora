-- Expand gateway lifecycle state without invalidating existing credentials.
ALTER TABLE "EdgeGateway"
ADD COLUMN "pendingCredentialHash" TEXT,
ADD COLUMN "pendingCredentialExpiresAt" TIMESTAMP(3),
ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "credentialRotatedAt" TIMESTAMP(3),
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN "lastTelemetryAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "EdgeGateway_pendingCredentialHash_key" ON "EdgeGateway"("pendingCredentialHash");

CREATE TABLE "GatewayHeartbeat" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "heartbeatId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "softwareVersion" TEXT NOT NULL,
    "publishingEnabled" BOOLEAN NOT NULL,
    "queueDepth" INTEGER NOT NULL,
    "deviceCount" INTEGER NOT NULL,
    CONSTRAINT "GatewayHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GatewayHeartbeat_gatewayId_receivedAt_idx" ON "GatewayHeartbeat"("gatewayId", "receivedAt" DESC);
CREATE UNIQUE INDEX "GatewayHeartbeat_gatewayId_heartbeatId_key" ON "GatewayHeartbeat"("gatewayId", "heartbeatId");

ALTER TABLE "GatewayHeartbeat"
ADD CONSTRAINT "GatewayHeartbeat_gatewayId_fkey"
FOREIGN KEY ("gatewayId") REFERENCES "EdgeGateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
