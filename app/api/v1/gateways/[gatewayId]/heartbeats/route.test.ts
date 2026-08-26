import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateGateway: vi.fn(),
  heartbeatCreate: vi.fn(),
  heartbeatFindUnique: vi.fn(),
  gatewayUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/gateway/authentication", () => ({
  authenticateGateway: mocks.authenticateGateway,
}));
vi.mock("@/lib/db", () => ({
  db: {
    gatewayHeartbeat: {
      create: mocks.heartbeatCreate,
      findUnique: mocks.heartbeatFindUnique,
    },
    edgeGateway: { update: mocks.gatewayUpdate },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/v1/gateways/[gatewayId]/heartbeats/route";

const context = { params: Promise.resolve({ gatewayId: "gateway-1" }) };

function heartbeatRequest(publishIntervalSec = 60) {
  return new Request("http://localhost/api/v1/gateways/gateway-1/heartbeats", {
    method: "POST",
    headers: {
      Authorization: "Bearer gateway-credential-that-is-long-enough",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: "1.0",
      heartbeatId: "52bcdd2b-cc48-4677-aac4-f987789724f5",
      gatewayId: "gateway-1",
      sentAt: new Date().toISOString(),
      softwareVersion: "0.4.0",
      publishingEnabled: true,
      publishIntervalSec,
      queueDepth: 0,
      deviceCount: 7,
    }),
  });
}

describe("gateway heartbeat cadence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateGateway.mockResolvedValue({
      id: "gateway-1",
      siteId: "site-1",
      mode: "VIRTUAL",
      expectedIntervalSec: 30,
      credentialVersion: 1,
    });
    mocks.heartbeatFindUnique.mockResolvedValue(null);
    mocks.heartbeatCreate.mockReturnValue({ operation: "heartbeat-create" });
    mocks.gatewayUpdate.mockReturnValue({ operation: "gateway-update" });
    mocks.transaction.mockResolvedValue([]);
  });

  it("synchronizes the authenticated gateway publish cadence", async () => {
    const response = await POST(heartbeatRequest(60), context);

    expect(response.status).toBe(201);
    expect(mocks.gatewayUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "gateway-1" },
      data: expect.objectContaining({ expectedIntervalSec: 60 }),
    }));
    expect(await response.json()).toMatchObject({ data: { expectedIntervalSec: 60 } });
  });

  it("rejects an invalid cadence before writing heartbeat state", async () => {
    const response = await POST(heartbeatRequest(5), context);

    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
