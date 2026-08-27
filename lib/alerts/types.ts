export const alertTypes = [
  "GRID_OUTAGE",
  "GATEWAY_OFFLINE",
  "DEVICE_OFFLINE",
  "INVERTER_FAULT",
  "BATTERY_LOW",
  "PV_UNDERPERFORMANCE",
] as const;
export type AlertType = (typeof alertTypes)[number];

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
export type AlertEvidenceQuality = "SIMULATED" | "MEASURED" | "MIXED";

export type AlertCandidate = {
  key: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  summary: string;
  evidenceQuality: AlertEvidenceQuality;
  evidence: Record<string, string | number | boolean | null>;
};

export type OpenAlertIncident = {
  id: string;
  openKey: string;
  type: AlertType;
  status: "ACTIVE" | "ACKNOWLEDGED";
};

export type AlertIncidentView = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  summary: string;
  evidenceQuality: AlertEvidenceQuality;
  evidence: Record<string, unknown>;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
};

export type AlertsView = {
  site: {
    id: string;
    name: string;
    timezone: string;
    mode: "SIMULATED" | "HARDWARE";
  };
  summary: {
    open: number;
    critical: number;
    acknowledged: number;
    resolved: number;
  };
  incidents: AlertIncidentView[];
};
