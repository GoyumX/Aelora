# Weather ingestion and provenance

Aelora uses Open-Meteo as a server-side weather source. The dashboard never calls Open-Meteo directly and never waits for the provider during rendering. A sync job fetches and validates weather, persists it in PostgreSQL, and the dashboard reads the latest stored observation.

## Data flow

```text
Scheduler, local operator, or authenticated owner
        |
        v
Weather sync route --> Open-Meteo forecast API
        |                    |
        |                    v
        |              Zod validation
        |              UTC normalization
        v
PostgreSQL transaction
  - current WeatherObservation (idempotent upsert)
  - immutable WeatherForecastRun
  - 168 hourly WeatherForecastPoint rows
        |
        v
Dashboard server component --> stored data only
```

The provider request is canonical:

- `timezone=UTC` prevents ambiguous local timestamps.
- `models=best_match` records the provider model selection used for the run.
- Current and hourly temperature, humidity, cloud, precipitation, wind, weather code, and solar-radiation variables are requested.
- The active arrays are capacity-weighted to one representative tilt and circular mean azimuth. Aelora's north-clockwise azimuth is converted once to Open-Meteo's south-centred convention.
- A ten-second provider timeout and strict response schema prevent a slow or malformed response from reaching persistence.
- Hourly arrays must have the same length as the timestamp array; misaligned data is rejected.

One representative orientation is an MVP approximation for mixed-orientation roofs. A future upgrade can request and persist array-specific tilted irradiance without changing the current observation contract.

## Persistence

`WeatherObservation` stores the latest observed conditions with a unique `(siteId, provider, observedAt)` key. A retry updates the same observation instead of duplicating it.

`WeatherForecastRun` stores the request coordinates, UTC mode, representative orientation, provider/model selection, issue time, attribution, and all hourly points. The unique `(siteId, provider, fetchedAt)` key makes a retry at the same scheduled time idempotent. Forecast runs are retained so future ML evaluation can use the information that was actually available at prediction time.

## Endpoints and authorization

```text
GET  /api/sites/:siteId/weather
POST /api/sites/:siteId/weather
POST /api/internal/weather-sync
POST /api/internal/intelligence-refresh
```

The site routes require an Aelora session and enforce owner/admin site access. Cross-owner access returns `404`. The owner-scoped `POST` powers the explicit dashboard refresh control; it returns only a safe result and never provider response bodies. The internal batch routes require:

```http
Authorization: Bearer <WEATHER_SYNC_SECRET>
```

Set a long random `WEATHER_SYNC_SECRET` in the deployment environment. Configure the host scheduler to call `/api/internal/intelligence-refresh` every 30 minutes. Weather has a 30-minute freshness floor; the same job only reruns a solar forecast when its latest run is at least 12 hours old. For a local combined refresh in PowerShell:

```powershell
npm run intelligence:refresh
```

To exercise the protected HTTP endpoint instead:

```powershell
$headers = @{ Authorization = "Bearer $env:WEATHER_SYNC_SECRET" }
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/internal/intelligence-refresh" -Headers $headers
```

The scheduled batch skips sites refreshed within the last 30 minutes and isolates failures: one provider failure is reported for that site while the remaining active sites continue. Provider response bodies and internal exception messages are never returned to browser clients.

## Dashboard semantics

- Provider data fetched within 30 minutes is labelled `Fresh`.
- Older provider data remains visible but is labelled `Stale`.
- If no provider observation exists, the card explicitly uses gateway irradiance and panel temperature and labels them `Gateway fallback`.
- Open-Meteo attribution is displayed whenever its data is shown.
- The dashboard renders the next 12 stored hourly weather points and aggregates the same immutable run into seven local-day summaries.
- While an authenticated dashboard is open, it refreshes stored application data every minute and requests weather on the 30-minute cadence. The protected scheduler provides the reliable closed-browser path.

Open-Meteo data is suitable for development and research subject to its current licence and usage terms. Production deployment must re-check the provider's commercial plan and attribution requirements.
