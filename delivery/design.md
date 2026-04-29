# Design

Date: 2026-04-29

## Components

- `src/server.js`: Node HTTP server, static file serving, route handling, rate limiting, safe JSON responses, and startup wiring.
- `src/weatherService.js`: city validation, Open-Meteo geocoding, forecast retrieval, weather-code mapping, response normalization, and provider error handling.
- `public/index.html`: application shell.
- `public/styles.css`: responsive visual layout and states.
- `public/app.js`: browser workflow, API calls, rendering, local storage, refresh behavior, and error handling.
- `test/*.test.js`: Node test coverage with mocked provider calls.

## Data Flow

1. Browser submits city and units to `/api/weather`.
2. Server validates city and units, then applies per-client rate limiting.
3. Weather service calls Open-Meteo geocoding with a timeout and URL-encoded query parameters.
4. Weather service uses the best geocoding result to call Open-Meteo forecast with current and daily fields.
5. Server returns a normalized JSON response to the browser.
6. Browser renders current conditions, planning details, and data freshness.

## Trust Boundaries

- Browser input crosses into the backend at `/api/weather`.
- Backend crosses to external Open-Meteo APIs.
- Browser local storage holds only the last successful city and unit preference.

## Security Controls

- Validate city length and allowed characters before external calls.
- Build provider URLs with `URL` and `URLSearchParams`.
- No shell execution, database access, credentials, or server-side persistence.
- Return bounded error objects without stack traces.
- Apply in-memory rate limiting to reduce accidental or abusive provider traffic.

## Failure Modes

- Invalid user input: return `400`; frontend shows correction message.
- City not found: return `404`; frontend keeps last result visible.
- Provider timeout or non-OK response: return `502`; frontend displays retry guidance.
- Static asset miss: return `404`.

## Compatibility and Migration

The repository has no existing app or schema, so there are no data migrations or compatibility constraints. The change is additive on a new branch.

## Rollout and Rollback

Rollout is a standard application release after tests and smoke checks pass. Rollback is reverting the PR or redeploying the previous commit; no persisted data or migration rollback is required.

## Observability

Server logs startup and provider lookup failures with sanitized city context. Operators can use `/api/health`, browser behavior, and server logs for immediate diagnosis.
