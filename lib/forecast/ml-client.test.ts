import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MlForecastContractError,
  MlForecastUnavailableError,
  requestSolarForecast,
  type MlForecastRequest,
} from "@/lib/forecast/ml-client";

const request: MlForecastRequest = {
  requestId: "request-1",
  siteId: "site-1",
  issuedAt: "2026-08-21T04:00:00.000Z",
  installedCapacityKwp: 4.5,
  points: [{
    validAt: "2026-08-21T05:00:00.000Z",
    shortwaveRadiationWm2: 600,
    temperatureC: 29,
    relativeHumidityPct: 70,
    windSpeedKmh: 14,
    precipitationMm: 0,
    cloudCoverPct: 25,
  }],
};

const validResponse = {
  data: {
    requestId: "request-1",
    siteId: "site-1",
    issuedAt: "2026-08-21T04:00:00.000Z",
    model: {
      name: "Aelora UNISOLAR capacity challenger v3",
      family: "random_forest",
      status: "CHALLENGER_NOT_ACTIVE",
      artifactSha256: "b".repeat(64),
      productionActivationAllowed: false,
      featureSchemaVersion: "1.0.0",
    },
    points: [{
      validAt: "2026-08-21T05:00:00.000Z",
      leadHours: 1,
      capacityFactor: 0.42,
      estimatedPowerKw: 1.89,
      estimatedEnergyKwh: 1.89,
      source: "MODEL",
    }],
    totals: { estimatedEnergyKwh: 1.89, daylightHours: 1 },
    limitations: ["Challenger model: production activation is not approved."],
  },
};

describe("ML forecast client", () => {
  it("sends the private token server-side and validates the typed response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(validResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(requestSolarForecast(request, {
      baseUrl: "http://127.0.0.1:8000/",
      token: "a-private-token-that-is-at-least-32-characters",
      fetcher,
    })).resolves.toEqual(validResponse.data);

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/solar-forecasts",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: "Bearer a-private-token-that-is-at-least-32-characters",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("returns a safe unavailable error without exposing an upstream response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("secret upstream detail", { status: 503 }));

    await expect(requestSolarForecast(request, {
      baseUrl: "http://127.0.0.1:8000",
      token: "a-private-token-that-is-at-least-32-characters",
      fetcher,
    })).rejects.toBeInstanceOf(MlForecastUnavailableError);
  });

  it("rejects a malformed success response instead of persisting it", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { requestId: "request-1" } }));

    await expect(requestSolarForecast(request, {
      baseUrl: "http://127.0.0.1:8000",
      token: "a-private-token-that-is-at-least-32-characters",
      fetcher,
    })).rejects.toBeInstanceOf(MlForecastContractError);
  });
});
