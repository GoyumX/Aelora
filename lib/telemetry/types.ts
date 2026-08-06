export const telemetryScenarios = [
  "NORMAL",
  "SUDDEN_CLOUD",
  "PARTIAL_SHADING",
  "GRID_OUTAGE",
  "INVERTER_FAULT",
  "BATTERY_FAULT",
] as const;

export type TelemetryScenarioCode = (typeof telemetryScenarios)[number];
export type TelemetryDeviceStatus = "NORMAL" | "CLOUD_RAMP" | "ARRAY_UNDERPERFORMING" | "GRID_OUTAGE" | "INVERTER_FAULT" | "BATTERY_FAULT";

export type TelemetrySnapshot = {
  siteId: string;
  siteName: string;
  source: "SIMULATOR" | "HARDWARE";
  quality: "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";
  observedAt: string;
  scenario: { code: TelemetryScenarioCode; label: string; message: string };
  deviceStatus: TelemetryDeviceStatus;
  pvPowerW: number;
  pvEnergyTodayWh: number;
  loadPowerW: number;
  gridPowerW: number;
  batteryPowerW: number;
  batterySocPct: number;
  dcVoltageV: number;
  dcCurrentA: number;
  acVoltageV: number;
  acCurrentA: number;
  gridVoltageV: number;
  frequencyHz: number;
  inverterTemperatureC: number;
  panelTemperatureC: number;
  irradianceWm2: number;
  arrays: Array<{ id: string; name: string; powerW: number; status: "NORMAL" | "UNDERPERFORMING" | "OFFLINE" }>;
  series: Array<{ observedAt: string; pvPowerW: number; loadPowerW: number }>;
};

export type TelemetryApiResponse = {
  data: TelemetrySnapshot;
  meta: { refreshAfterSeconds: number };
};
