"use client";

import { CloudDownload, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  FORECAST_REFRESH_INTERVAL_MS,
  LIVE_DASHBOARD_REFRESH_INTERVAL_MS,
  WEATHER_REFRESH_INTERVAL_MS,
  isForecastRefreshDue,
  isWeatherRefreshDue,
} from "@/lib/refresh/freshness";

type Action = "weather" | "forecast" | null;

export function DynamicDataControls({
  autoRefresh,
  compact = false,
  forecastCreatedAt,
  showForecast = false,
  siteId,
  weatherFetchedAt,
}: {
  autoRefresh: boolean;
  compact?: boolean;
  forecastCreatedAt?: string | null;
  showForecast?: boolean;
  siteId: string;
  weatherFetchedAt?: string | null;
}) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<Action>(null);
  const [message, setMessage] = useState<string | null>(null);

  const request = useCallback(async (action: Exclude<Action, null>, automatic = false) => {
    if (!automatic) setActiveAction(action);
    setMessage(null);
    try {
      if (action === "forecast") {
        const weatherResponse = await fetch(`/api/sites/${siteId}/weather`, { method: "POST" });
        if (!weatherResponse.ok) throw new Error("Weather could not be refreshed before inference.");
      }
      const response = await fetch(
        action === "weather" ? `/api/sites/${siteId}/weather` : `/api/sites/${siteId}/forecast`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? `${action === "weather" ? "Weather" : "Forecast"} refresh failed.`);
      }
      setMessage(action === "weather" ? "Weather updated." : "Weather updated and AI forecast rerun.");
      router.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Refresh failed.");
    } finally {
      if (!automatic) setActiveAction(null);
    }
  }, [router, siteId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const now = new Date();
    const dueAction = showForecast && isForecastRefreshDue(forecastCreatedAt, now)
      ? "forecast"
      : isWeatherRefreshDue(weatherFetchedAt, now) ? "weather" : null;
    // Let the page become interactive first; provider calls must never delay navigation.
    const dueTimer = dueAction
      ? window.setTimeout(() => void request(dueAction, true), LIVE_DASHBOARD_REFRESH_INTERVAL_MS)
      : null;

    const liveTimer = window.setInterval(() => router.refresh(), LIVE_DASHBOARD_REFRESH_INTERVAL_MS);
    const weatherTimer = window.setInterval(() => void request("weather", true), WEATHER_REFRESH_INTERVAL_MS);
    const forecastTimer = showForecast
      ? window.setInterval(() => void request("forecast", true), FORECAST_REFRESH_INTERVAL_MS)
      : null;
    return () => {
      window.clearInterval(liveTimer);
      window.clearInterval(weatherTimer);
      if (forecastTimer != null) window.clearInterval(forecastTimer);
      if (dueTimer != null) window.clearTimeout(dueTimer);
    };
  }, [autoRefresh, forecastCreatedAt, request, router, showForecast, weatherFetchedAt]);

  return (
    <div className={compact ? "space-y-2" : "flex flex-wrap items-center justify-end gap-2"}>
      <div className="flex flex-wrap gap-2">
        <Button disabled={activeAction !== null} onClick={() => void request("weather")} size={compact ? "sm" : "default"} variant="outline">
          {activeAction === "weather" ? <RefreshCw aria-hidden="true" className="animate-spin" /> : <CloudDownload aria-hidden="true" />}
          Refresh weather
        </Button>
        {showForecast ? (
          <Button disabled={activeAction !== null} onClick={() => void request("forecast")} size={compact ? "sm" : "default"}>
            {activeAction === "forecast" ? <RefreshCw aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
            Rerun AI forecast
          </Button>
        ) : null}
      </div>
      {message ? <p aria-live="polite" className="max-w-sm text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
