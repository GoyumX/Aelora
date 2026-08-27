import { z } from "zod";

export const OPEN_METEO_ATTRIBUTION = "Weather data by Open-Meteo.com";
export const OPEN_METEO_MODEL_SELECTION = "best_match";

const currentVariables = [
  "temperature_2m", "relative_humidity_2m", "apparent_temperature", "precipitation",
  "weather_code", "cloud_cover", "wind_speed_10m", "wind_direction_10m",
  "shortwave_radiation", "direct_radiation", "diffuse_radiation",
  "direct_normal_irradiance", "global_tilted_irradiance", "is_day",
] as const;

const hourlyVariables = [
  "temperature_2m", "relative_humidity_2m", "cloud_cover",
  "precipitation_probability", "precipitation", "wind_speed_10m", "weather_code",
  "shortwave_radiation", "direct_radiation", "diffuse_radiation",
  "direct_normal_irradiance", "global_tilted_irradiance",
] as const;

type WeatherFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type OpenMeteoForecastRequest = {
  latitude: number;
  longitude: number;
  forecastDays?: number;
  tiltDeg?: number;
  azimuthDeg?: number;
  fetcher?: WeatherFetcher;
};

const numberArray = z.array(z.number().nullable()).max(192);
const openMeteoForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  generationtime_ms: z.number().optional(),
  utc_offset_seconds: z.number().int().optional(),
  timezone: z.string().optional(),
  timezone_abbreviation: z.string().optional(),
  current: z.object({
    time: z.string(),
    interval: z.number().optional(),
    temperature_2m: z.number(),
    relative_humidity_2m: z.number().int().nullable().optional(),
    apparent_temperature: z.number().nullable().optional(),
    precipitation: z.number().nullable().optional(),
    weather_code: z.number().int(),
    cloud_cover: z.number().int().nullable().optional(),
    wind_speed_10m: z.number().nullable().optional(),
    wind_direction_10m: z.number().int().nullable().optional(),
    shortwave_radiation: z.number().nullable().optional(),
    direct_radiation: z.number().nullable().optional(),
    diffuse_radiation: z.number().nullable().optional(),
    direct_normal_irradiance: z.number().nullable().optional(),
    global_tilted_irradiance: z.number().nullable().optional(),
    is_day: z.number().int().nullable().optional(),
  }),
  hourly: z.object({
    time: z.array(z.string()).max(192),
    temperature_2m: numberArray,
    relative_humidity_2m: numberArray,
    cloud_cover: numberArray,
    precipitation_probability: numberArray,
    precipitation: numberArray,
    wind_speed_10m: numberArray,
    weather_code: numberArray,
    shortwave_radiation: numberArray,
    direct_radiation: numberArray,
    diffuse_radiation: numberArray,
    direct_normal_irradiance: numberArray,
    global_tilted_irradiance: numberArray.optional(),
  }),
});

export type OpenMeteoForecastPayload = z.infer<typeof openMeteoForecastSchema>;

export class WeatherProviderError extends Error {
  constructor(public readonly status: number) {
    super(`Weather provider returned HTTP ${status}`);
    this.name = "WeatherProviderError";
  }
}

function optionalInteger(value: number | null | undefined) {
  return value == null ? null : Math.round(value);
}

function optionalNumber(value: number | null | undefined) {
  return value == null ? null : value;
}

function utcDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    throw new Error(`Weather provider returned an invalid UTC timestamp: ${value}`);
  }
  return new Date(`${value}Z`);
}

function assertAlignedHourlyArrays(hourly: OpenMeteoForecastPayload["hourly"]) {
  const expectedLength = hourly.time.length;
  for (const [name, values] of Object.entries(hourly)) {
    if (name !== "time" && values && values.length !== expectedLength) {
      throw new Error(`Weather provider hourly arrays are misaligned: ${name}`);
    }
  }
}

export function weatherCodeCondition(code: number | null | undefined) {
  if (code == null) return "Unknown";
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Fog";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Mixed conditions";
}

export function buildOpenMeteoForecastUrl(input: OpenMeteoForecastRequest) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", String(input.forecastDays ?? 7));
  url.searchParams.set("models", OPEN_METEO_MODEL_SELECTION);
  url.searchParams.set("current", currentVariables.join(","));
  url.searchParams.set("hourly", hourlyVariables.join(","));
  if (input.tiltDeg != null) url.searchParams.set("tilt", String(input.tiltDeg));
  if (input.azimuthDeg != null) url.searchParams.set("azimuth", String(input.azimuthDeg));
  return url;
}

export async function fetchOpenMeteoForecast(input: OpenMeteoForecastRequest) {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(buildOpenMeteoForecastUrl(input), {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new WeatherProviderError(response.status);
  return openMeteoForecastSchema.parse(await response.json());
}

export function summarizeOpenMeteoForecast(
  payloadInput: OpenMeteoForecastPayload,
  fetchedAt = new Date(),
) {
  const payload = openMeteoForecastSchema.parse(payloadInput);
  assertAlignedHourlyArrays(payload.hourly);

  return {
    provider: "OPEN_METEO" as const,
    modelSelection: OPEN_METEO_MODEL_SELECTION,
    current: {
      observedAt: utcDate(payload.current.time),
      fetchedAt,
      condition: weatherCodeCondition(payload.current.weather_code),
      temperatureC: payload.current.temperature_2m,
      apparentTemperatureC: optionalNumber(payload.current.apparent_temperature),
      relativeHumidityPct: optionalInteger(payload.current.relative_humidity_2m),
      cloudCoverPct: optionalInteger(payload.current.cloud_cover),
      precipitationMm: optionalNumber(payload.current.precipitation),
      weatherCode: payload.current.weather_code,
      windSpeedKmh: optionalNumber(payload.current.wind_speed_10m),
      windDirectionDeg: optionalInteger(payload.current.wind_direction_10m),
      shortwaveRadiationWm2: optionalNumber(payload.current.shortwave_radiation),
      directRadiationWm2: optionalNumber(payload.current.direct_radiation),
      diffuseRadiationWm2: optionalNumber(payload.current.diffuse_radiation),
      directNormalIrradianceWm2: optionalNumber(payload.current.direct_normal_irradiance),
      globalTiltedIrradianceWm2: optionalNumber(payload.current.global_tilted_irradiance),
      isDay: payload.current.is_day == null ? null : payload.current.is_day === 1,
    },
    hourly: payload.hourly.time.map((time, index) => ({
      validAt: utcDate(time),
      condition: weatherCodeCondition(payload.hourly.weather_code[index]),
      temperatureC: optionalNumber(payload.hourly.temperature_2m[index]),
      relativeHumidityPct: optionalInteger(payload.hourly.relative_humidity_2m[index]),
      cloudCoverPct: optionalInteger(payload.hourly.cloud_cover[index]),
      precipitationProbabilityPct: optionalInteger(payload.hourly.precipitation_probability[index]),
      precipitationMm: optionalNumber(payload.hourly.precipitation[index]),
      windSpeedKmh: optionalNumber(payload.hourly.wind_speed_10m[index]),
      weatherCode: optionalInteger(payload.hourly.weather_code[index]),
      shortwaveRadiationWm2: optionalNumber(payload.hourly.shortwave_radiation[index]),
      directRadiationWm2: optionalNumber(payload.hourly.direct_radiation[index]),
      diffuseRadiationWm2: optionalNumber(payload.hourly.diffuse_radiation[index]),
      directNormalIrradianceWm2: optionalNumber(payload.hourly.direct_normal_irradiance[index]),
      globalTiltedIrradianceWm2: optionalNumber(payload.hourly.global_tilted_irradiance?.[index]),
    })),
  };
}
