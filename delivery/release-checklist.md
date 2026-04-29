# Release Checklist

Date: 2026-04-29

## Pre-Release Gates

- [x] `npm.cmd test` passes.
- [x] `npm.cmd run check` passes.
- [x] Local smoke check of `/api/health` passes.
- [x] Local smoke check of `/api/weather?city=Seattle&units=imperial` passes with approved network access.
- [x] Frontend assets are served by the same Node server at `/`.
- [x] Delivery docs are current.

## Configuration and Secrets

- No API key is required for Open-Meteo.
- Optional environment variables:
  - `PORT`: server port, default `3000`.
  - `HOST`: bind host, default `0.0.0.0`.
  - `WEATHER_TIMEOUT_MS`: provider timeout, default `6000`.
  - `RATE_LIMIT_WINDOW_MS`: rate-limit window, default `60000`.
  - `RATE_LIMIT_MAX`: requests per client per window, default `60`.

## Smoke Checks

- `curl http://localhost:3000/api/health`
- `curl "http://localhost:3000/api/weather?city=Seattle&units=imperial"`
- Browser search for `Seattle`.

## Rollback Triggers

- Elevated 5xx rate on `/api/weather`.
- Provider timeout causing unacceptable user-facing failures.
- Frontend cannot load or submit searches.
- Logs show unexpected sensitive data exposure.

## Rollback Steps

1. Stop rollout or remove the deployment from rotation.
2. Redeploy the previous known-good commit or revert the PR.
3. Confirm `/api/health` and adjacent app routes recover.
4. Review logs for failed requests and provider errors.

## Post-Release Verification

- Confirm live `/api/health` status.
- Confirm at least one city lookup returns current data.
- Confirm frontend error states are not showing for common city searches.
- Inspect logs for provider failures, rate-limit spikes, and unexpected stack traces.
