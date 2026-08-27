# Forecast verification and uncertainty contract

## Iteration compact

**Goal:** Join completed hourly solar forecasts to later site telemetry and make
error, data readiness, and uncertainty visible without activating the model.

**Who cares:** Site owners planning energy use, the project evaluator reviewing
model quality, and an administrator who may later approve a production model.

**Decision owner:** A human administrator. This pipeline can recommend review;
it cannot activate a model automatically.

**User action changed:** A user can distinguish an unevaluated forecast from a
challenger with measured evidence and can inspect 24-hour, 48-hour, and 7-day
error slices.

**Primary metrics:** Daylight MAE and weighted absolute percentage error
(wMAPE) for hourly energy. RMSE and signed bias are guardrails.

**Unacceptable mistakes:** Using telemetry recorded before the forecast as its
label, counting incomplete hours as ground truth, allowing repeated refreshes of
one issued weather snapshot to inflate evidence, treating simulated readings as
production validation, or using night-time zeroes to manufacture accuracy.

**Labels and timing:** A forecast point at `validAt` predicts the following
one-hour interval. It becomes label-eligible only after `validAt + 1 hour` and
only when at least 95% of the expected telemetry samples are present. The label
is interval generation in kWh, derived only from readings inside that interval.

**Deduplication:** Metric evidence is unique by model artifact, forecast issue
time, and valid time. Manually regenerating the same issued weather/model result
does not multiply its statistical weight.

**Slices:** lead hours 1–24, 25–48, and 49–168. Metrics exclude intervals where
both predicted and actual energy are below 0.05 kWh.

**Uncertainty:** A retrospective 90% absolute-error envelope is calculated per
horizon only after 24 unique daylight labels exist in that slice. Until then,
the UI says calibration is pending instead of showing an invented range.

**Promotion gates:** Production review requires only measured telemetry, at
least 100 unique daylight labels across at least 14 local dates, evidence in all
three horizon slices, wMAPE at or below 20%, and absolute bias no greater than
10% of mean actual energy. Passing these gates means `REVIEW_REQUIRED`, never
automatic activation. Simulation or mixed-quality evidence is always blocked.

**Fallback:** Forecast generation and the stored forecast remain available when
verification is empty or delayed. The model stays an inactive challenger.

## Data contract

Each persisted verification record references exactly one stored forecast point
and contains the completed interval, actual energy, signed/absolute/squared
error, coverage, sample cadence/count, label quality, and verification time.
Records are append-only evidence for a point; refresh is idempotent.

The UI and evaluation API expose aggregate metrics, horizon slices, calibration
readiness, label quality, and promotion status. They do not expose gateway
credentials, raw model tokens, or unrelated users' data.
