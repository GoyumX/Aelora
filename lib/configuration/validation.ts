import { z } from "zod";

const optionalText = z.string().trim().max(100).optional().transform((value) => value || undefined);

export const siteConfigurationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  timezone: z.string().trim().min(3).max(80),
});

export const solarArraySchema = z.object({
  name: z.string().trim().min(2).max(80),
  manufacturer: optionalText,
  model: optionalText,
  panelCount: z.coerce.number().int().min(1).max(5000),
  ratedPowerW: z.coerce.number().int().min(50).max(1000),
  tiltDeg: z.coerce.number().min(0).max(90),
  azimuthDeg: z.coerce.number().min(0).max(360),
  installationDate: z.string().optional().transform((value) => value ? new Date(`${value}T00:00:00.000Z`) : undefined),
  temperatureCoefficientPctC: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().min(-2).max(0).optional(),
  ),
});

export const inverterConfigurationSchema = z.object({
  manufacturer: z.string().trim().min(2).max(100),
  model: z.string().trim().min(1).max(100),
  serialAlias: optionalText,
  acRatingW: z.coerce.number().int().min(100).max(1_000_000),
  efficiencyPct: z.coerce.number().min(50).max(100),
  phase: z.coerce.number().int().min(1).max(3),
  communicationAdapter: z.enum(["SIMULATOR", "HTTP_PUSH", "MQTT", "MODBUS"]),
  pollingIntervalSec: z.coerce.number().int().min(5).max(3600),
});

export const batteryConfigurationSchema = z.object({
  enabled: z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.boolean(),
  ),
  manufacturer: optionalText,
  model: optionalText,
  usableCapacityWh: z.coerce.number().int().min(100).max(10_000_000),
  maxChargePowerW: z.coerce.number().int().min(0).max(1_000_000),
  maxDischargePowerW: z.coerce.number().int().min(0).max(1_000_000),
  minSocPct: z.coerce.number().int().min(0).max(100),
  maxSocPct: z.coerce.number().int().min(0).max(100),
  roundTripEfficiencyPct: z.coerce.number().min(50).max(100),
  reservePct: z.coerce.number().int().min(0).max(100),
}).superRefine((value, context) => {
  if (value.minSocPct >= value.maxSocPct) {
    context.addIssue({ code: "custom", path: ["maxSocPct"], message: "Maximum state of charge must exceed the minimum." });
  }
  if (value.reservePct < value.minSocPct || value.reservePct > value.maxSocPct) {
    context.addIssue({ code: "custom", path: ["reservePct"], message: "Reserve must be inside the configured state-of-charge range." });
  }
});

export function issuesMessage(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}
