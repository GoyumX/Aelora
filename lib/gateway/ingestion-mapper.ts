import type { GatewayDeviceObservationInput, TelemetryBatchInput } from "@/lib/gateway/contract";

export function buildReadingPersistence(
  snapshot: TelemetryBatchInput["siteSnapshot"],
  source: TelemetryBatchInput["source"],
) {
  return {
    observedAt: new Date(snapshot.observedAt),
    source: source === "VIRTUAL" ? "SIMULATOR" as const : "HARDWARE" as const,
    quality: source === "VIRTUAL" ? "SIMULATED" as const : "MEASURED" as const,
    pvPowerW: Math.round(snapshot.pvPowerW),
    pvEnergyTodayWh: Math.round(snapshot.pvEnergyTodayWh),
    loadPowerW: Math.round(snapshot.loadPowerW),
    gridPowerW: Math.round(snapshot.gridPowerW),
    batteryPowerW: Math.round(snapshot.batteryPowerW),
    batterySocPct: Math.round(snapshot.batterySocPct),
    dcVoltageV: snapshot.dcVoltageV,
    dcCurrentA: snapshot.dcCurrentA,
    acVoltageV: snapshot.acVoltageV,
    acCurrentA: snapshot.acCurrentA,
    gridVoltageV: snapshot.gridVoltageV,
    frequencyHz: snapshot.frequencyHz,
    inverterTemperatureC: snapshot.inverterTemperatureC,
    panelTemperatureC: snapshot.panelTemperatureC,
    irradianceWm2: Math.round(snapshot.irradianceWm2),
    deviceStatus: snapshot.deviceStatus,
  };
}

export function buildDevicePersistence(device: GatewayDeviceObservationInput) {
  return {
    externalId: device.externalId,
    kind: device.kind,
    name: device.name,
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: device.serialNumber,
    connectivityStatus: device.connectivityStatus,
    operationalState: device.operationalState,
    lastSeenAt: device.lastTelemetryAt ? new Date(device.lastTelemetryAt) : null,
    metrics: device.metrics,
  };
}
