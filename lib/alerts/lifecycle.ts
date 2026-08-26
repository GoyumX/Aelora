import type { AlertCandidate, AlertStatus, AlertType, OpenAlertIncident } from "@/lib/alerts/types";

export type IncidentCreate = AlertCandidate & {
  openKey: string;
  status: "ACTIVE";
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  occurrenceCount: 1;
};

export type IncidentUpdate = AlertCandidate & {
  id: string;
  status: Exclude<AlertStatus, "RESOLVED">;
  lastDetectedAt: Date;
  occurrenceIncrement: 1;
};

export type IncidentResolution = {
  id: string;
  resolvedAt: Date;
  resolutionReason: "EVIDENCE_CLEARED";
};

export function planIncidentReconciliation(
  siteId: string,
  existing: OpenAlertIncident[],
  candidates: AlertCandidate[],
  evaluatedTypes: AlertType[],
  now: Date,
) {
  const existingByKey = new Map(existing.map((item) => [item.openKey, item]));
  const detectedKeys = new Set<string>();
  const creates: IncidentCreate[] = [];
  const updates: IncidentUpdate[] = [];

  for (const candidate of candidates) {
    const openKey = `${siteId}:${candidate.key}`;
    detectedKeys.add(openKey);
    const incident = existingByKey.get(openKey);
    if (incident) {
      updates.push({
        ...candidate,
        id: incident.id,
        status: incident.status,
        lastDetectedAt: now,
        occurrenceIncrement: 1,
      });
    } else {
      creates.push({
        ...candidate,
        openKey,
        status: "ACTIVE",
        firstDetectedAt: now,
        lastDetectedAt: now,
        occurrenceCount: 1,
      });
    }
  }

  const authoritativeTypes = new Set(evaluatedTypes);
  const resolves = existing
    .filter((incident) => authoritativeTypes.has(incident.type) && !detectedKeys.has(incident.openKey))
    .map((incident) => ({
      id: incident.id,
      resolvedAt: now,
      resolutionReason: "EVIDENCE_CLEARED" as const,
    }));

  return { creates, updates, resolves };
}
