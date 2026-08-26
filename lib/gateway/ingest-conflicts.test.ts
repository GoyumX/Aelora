import { describe, expect, it } from "vitest";

import { isTelemetryTimestampConflict } from "@/lib/gateway/ingest-conflicts";

describe("gateway ingest conflicts", () => {
  it("recognizes the canonical site/source/timestamp uniqueness conflict as an idempotent replay", () => {
    expect(isTelemetryTimestampConflict({
      code: "P2002",
      meta: { target: ["siteId", "source", "observedAt"] },
    })).toBe(true);
    expect(isTelemetryTimestampConflict({
      code: "P2002",
      meta: { target: "TelemetryReading_siteId_source_observedAt_key" },
    })).toBe(true);
  });

  it("does not hide unrelated unique conflicts", () => {
    expect(isTelemetryTimestampConflict({
      code: "P2002",
      meta: { target: ["gatewayId", "sequence"] },
    })).toBe(false);
    expect(isTelemetryTimestampConflict(new Error("database unavailable"))).toBe(false);
  });
});
