export type HouseholdLoadForecastMethod =
  | "HISTORICAL_HOURLY_MEDIAN"
  | "NO_HISTORY";

export type HouseholdLoadForecast = {
  method: HouseholdLoadForecastMethod;
  estimatedLoadEnergyKwh: number | null;
  points: Array<{
    estimatedLoadPowerKw: number | null;
    estimatedLoadEnergyKwh: number | null;
  }>;
};

function localHour(value: Date, timezone: string) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(value).find((part) => part.type === "hour")?.value;

  return Number(hour ?? 0) % 24;
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function round(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

export function buildHouseholdLoadForecast(
  readings: Array<{ observedAt: Date; loadPowerW: number }>,
  validTimes: Date[],
  timezone: string,
): HouseholdLoadForecast {
  if (!readings.length) {
    return {
      method: "NO_HISTORY",
      estimatedLoadEnergyKwh: null,
      points: validTimes.map(() => ({
        estimatedLoadPowerKw: null,
        estimatedLoadEnergyKwh: null,
      })),
    };
  }

  const hourlySamples = new Map<number, number[]>();
  for (const reading of readings) {
    const hour = localHour(reading.observedAt, timezone);
    const samples = hourlySamples.get(hour) ?? [];
    samples.push(reading.loadPowerW / 1_000);
    hourlySamples.set(hour, samples);
  }
  const overallMedian = median(readings.map((reading) => reading.loadPowerW / 1_000));
  const points = validTimes.map((validAt) => {
    const samples = hourlySamples.get(localHour(validAt, timezone));
    const estimatedLoadPowerKw = round(samples?.length ? median(samples) : overallMedian);
    return {
      estimatedLoadPowerKw,
      estimatedLoadEnergyKwh: estimatedLoadPowerKw,
    };
  });

  return {
    method: "HISTORICAL_HOURLY_MEDIAN",
    estimatedLoadEnergyKwh: round(points.reduce(
      (total, point) => total + point.estimatedLoadEnergyKwh,
      0,
    )),
    points,
  };
}
