export const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
export const FORECAST_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const LIVE_DASHBOARD_REFRESH_INTERVAL_MS = 60 * 1000;
export const DASHBOARD_FORECAST_ROLL_INTERVAL_MS = 60 * 60 * 1000;

function isDue(value: Date | string | null | undefined, intervalMs: number, now: Date) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || now.getTime() - timestamp >= intervalMs;
}

export function isWeatherRefreshDue(value: Date | string | null | undefined, now = new Date()) {
  return isDue(value, WEATHER_REFRESH_INTERVAL_MS, now);
}

export function isForecastRefreshDue(value: Date | string | null | undefined, now = new Date()) {
  return isDue(value, FORECAST_REFRESH_INTERVAL_MS, now);
}
