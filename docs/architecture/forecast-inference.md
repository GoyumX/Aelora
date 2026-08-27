# Forecast inference and persistence

## Implemented boundary

Aelora keeps the browser, Next.js application, Python model, and PostgreSQL
storage as distinct trust boundaries:

```text
Browser session
    |
    v
POST /api/sites/:siteId/forecast
    | owner/admin scope
    v
Next.js forecast service
    | reads effective array capacity + immutable stored weather run
    | Bearer AELORA_ML_INTERNAL_API_TOKEN
    v
POST FastAPI /api/v1/solar-forecasts
    | typed challenger result
    v
PostgreSQL transaction
    - SolarForecastRun
    - 1..168 SolarForecastPoint rows
    |
    v
AI Forecast server page reads the latest stored run
```

The browser never receives the ML base URL or internal token. Neither variable
uses the `NEXT_PUBLIC_` prefix. The FastAPI request happens before the database
transaction; only a fully validated response opens the short transaction that
inserts the run and all points atomically.

## Input provenance

Generation uses:

- the active, non-archived panel arrays at generation time, summed and stored as
  `installedCapacityKwp` on the forecast run;
- the most recent immutable Open-Meteo `WeatherForecastRun`;
- up to 168 strictly hourly future points;
- shortwave radiation, air temperature, humidity, wind, precipitation, and
  cloud cover from the stored provider snapshot;
- the weather run's `fetchedAt` timestamp as `issuedAt` so future backtests know
  when those weather inputs were available.

Missing capacity, weather, required fields, or hourly continuity stops the call
before inference. Model request/site identity mismatches and malformed success
responses are rejected before persistence.

## Stored model evidence

`SolarForecastRun` stores request ID, weather-run relation, capacity snapshot,
model name/family/status, artifact SHA-256, feature-schema version, activation
flag, total energy, daylight hours, limitations, issue time, and creation time.
Every `SolarForecastPoint` stores valid time, actual lead hours, normalized
capacity factor, average kW, hourly kWh, and source.

The current Random Forest is deliberately displayed as
`CHALLENGER_NOT_ACTIVE`. That provenance remains visible without occupying the
primary seven-day planning area.

## Browser-facing routes

| Method and path | Result |
| --- | --- |
| `POST /api/sites/:siteId/forecast` | Generate through FastAPI and atomically persist; returns `201`. |
| `GET /api/sites/:siteId/forecast/latest` | Read the latest stored owner-scoped DTO. |
| `POST /api/internal/intelligence-refresh` | Bearer-protected weather-first batch refresh; reruns forecasts only after 12 hours. |

Both routes require an active Aelora session, return `private, no-store`, and
use indistinguishable `404` behavior for missing/inaccessible stored data.
Expected generation prerequisites return `409`; ML configuration/unavailability
returns `503`; a malformed model contract returns `502`. Upstream response
bodies and secrets are never returned.

## Local operation

Use the same long random token in both services:

```dotenv
# Project/aelora-ml-service/.env
AELORA_ML_INTERNAL_API_TOKEN=<same-secret>

# Project/aelora/.env
AELORA_ML_BASE_URL=http://127.0.0.1:8000
AELORA_ML_INTERNAL_API_TOKEN=<same-secret>
```

Start PostgreSQL, the FastAPI service on port 8000, and Next.js on port 3000.
Sync weather before generating a forecast. A successful forecast remains in
PostgreSQL and can still render if FastAPI later goes offline.

For an authenticated-service-layer smoke check without opening the browser:

```powershell
npm run weather:sync
npm run forecast:smoke
```

For the production-equivalent combined cycle, run `npm run intelligence:refresh`
or schedule the protected internal endpoint every 30 minutes. The batch first
stores Open-Meteo data, then checks the 12-hour model freshness gate. The
dashboard's 48-hour card is a rolling future window over the latest stored run,
so elapsed points disappear on its hourly refresh without pretending they are
new inference results. The AI page also removes elapsed points, preventing a
previous date from remaining in the upcoming seven-day cards.
