import "server-only";

import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });

const mlWeatherPointSchema = z.object({
  validAt: isoDateTime,
  shortwaveRadiationWm2: z.number().min(0).max(1_600),
  temperatureC: z.number().min(-80).max(80),
  relativeHumidityPct: z.number().min(0).max(100),
  windSpeedKmh: z.number().min(0).max(400),
  precipitationMm: z.number().min(0).max(500),
  cloudCoverPct: z.number().min(0).max(100),
});

export const mlForecastRequestSchema = z.object({
  requestId: z.string().min(1).max(128),
  siteId: z.string().min(1).max(128),
  issuedAt: isoDateTime,
  installedCapacityKwp: z.number().positive().max(1_000_000),
  points: z.array(mlWeatherPointSchema).min(1).max(168),
});

const mlForecastPointSchema = z.object({
  validAt: isoDateTime,
  leadHours: z.number().nonnegative(),
  capacityFactor: z.number().min(0).max(1.25),
  estimatedPowerKw: z.number().nonnegative(),
  estimatedEnergyKwh: z.number().nonnegative(),
  source: z.literal("MODEL"),
});

const mlForecastDataSchema = z.object({
  requestId: z.string().min(1),
  siteId: z.string().min(1),
  issuedAt: isoDateTime,
  model: z.object({
    name: z.string().min(1),
    family: z.string().min(1),
    status: z.string().min(1),
    artifactSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    productionActivationAllowed: z.boolean(),
    featureSchemaVersion: z.string().min(1),
  }),
  points: z.array(mlForecastPointSchema).min(1).max(168),
  totals: z.object({
    estimatedEnergyKwh: z.number().nonnegative(),
    daylightHours: z.number().int().nonnegative(),
  }),
  limitations: z.array(z.string()),
});

const mlForecastEnvelopeSchema = z.object({ data: mlForecastDataSchema });

const mlServiceConfigSchema = z.object({
  baseUrl: z.url(),
  token: z.string().min(32),
});

export type MlForecastRequest = z.infer<typeof mlForecastRequestSchema>;
export type MlForecastData = z.infer<typeof mlForecastDataSchema>;

export class MlForecastConfigurationError extends Error {
  constructor() {
    super("ML service configuration is unavailable");
    this.name = "MlForecastConfigurationError";
  }
}

export class MlForecastUnavailableError extends Error {
  constructor() {
    super("ML forecast service is unavailable");
    this.name = "MlForecastUnavailableError";
  }
}

export class MlForecastContractError extends Error {
  constructor() {
    super("ML forecast response failed contract validation");
    this.name = "MlForecastContractError";
  }
}

type MlClientOptions = {
  baseUrl?: string;
  token?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

function resolveConfig(options: MlClientOptions) {
  const parsed = mlServiceConfigSchema.safeParse({
    baseUrl: options.baseUrl ?? process.env.AELORA_ML_BASE_URL,
    token: options.token ?? process.env.AELORA_ML_INTERNAL_API_TOKEN,
  });
  if (!parsed.success) throw new MlForecastConfigurationError();
  return parsed.data;
}

export async function requestSolarForecast(
  input: MlForecastRequest,
  options: MlClientOptions = {},
): Promise<MlForecastData> {
  const request = mlForecastRequestSchema.parse(input);
  const config = resolveConfig(options);
  const fetcher = options.fetcher ?? fetch;
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/api/v1/solar-forecasts`;

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
  } catch {
    throw new MlForecastUnavailableError();
  }

  if (!response.ok) throw new MlForecastUnavailableError();

  const payload = await response.json().catch(() => null);
  const parsed = mlForecastEnvelopeSchema.safeParse(payload);
  if (!parsed.success) throw new MlForecastContractError();
  return parsed.data.data;
}
