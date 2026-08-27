import { describe, expect, it } from "vitest";

import { planIncidentReconciliation } from "@/lib/alerts/lifecycle";
import type { AlertCandidate, OpenAlertIncident } from "@/lib/alerts/types";

const now = new Date("2026-08-21T08:00:00.000Z");
const candidate: AlertCandidate = {
  key: "site:grid-outage",
  type: "GRID_OUTAGE",
  severity: "CRITICAL",
  title: "Grid outage detected",
  summary: "Grid voltage stayed below 10 V for 60 seconds.",
  evidenceQuality: "SIMULATED",
  evidence: { sampleCount: 3 },
};

describe("alert incident reconciliation", () => {
  it("updates an acknowledged open incident instead of creating duplicate noise", () => {
    const existing: OpenAlertIncident[] = [{ id: "alert-1", openKey: "site-1:site:grid-outage", type: "GRID_OUTAGE", status: "ACKNOWLEDGED" }];

    const plan = planIncidentReconciliation("site-1", existing, [candidate], ["GRID_OUTAGE"], now);

    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toEqual([expect.objectContaining({ id: "alert-1", status: "ACKNOWLEDGED", occurrenceIncrement: 1 })]);
    expect(plan.resolves).toHaveLength(0);
  });

  it("auto-resolves only incident types for which current evidence is authoritative", () => {
    const existing: OpenAlertIncident[] = [
      { id: "grid-1", openKey: "site-1:site:grid-outage", type: "GRID_OUTAGE", status: "ACTIVE" },
      { id: "device-1", openKey: "site-1:device:inv-1:fault", type: "INVERTER_FAULT", status: "ACTIVE" },
    ];

    const plan = planIncidentReconciliation("site-1", existing, [], ["GRID_OUTAGE"], now);

    expect(plan.resolves).toEqual([{ id: "grid-1", resolvedAt: now, resolutionReason: "EVIDENCE_CLEARED" }]);
    expect(plan.resolves).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "device-1" })]));
  });

  it("creates a new incident after an earlier incident has been resolved and is no longer open", () => {
    const plan = planIncidentReconciliation("site-1", [], [candidate], ["GRID_OUTAGE"], now);

    expect(plan.creates).toEqual([
      expect.objectContaining({ openKey: "site-1:site:grid-outage", status: "ACTIVE", occurrenceCount: 1 }),
    ]);
  });
});
