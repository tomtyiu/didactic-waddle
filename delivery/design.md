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

## UI Professionalization Design Addendum

Request date: 2026-04-29

Frontend responsibilities:

- `public/index.html` now separates the command panel, status region, current condition panel, current detail metrics, and daily detail metrics with accessible section labels.
- `public/styles.css` owns the visual hierarchy: neutral page chrome, restrained accent colors, segmented unit control, status tones, durable card sizing, and mobile breakpoints.
- `public/app.js` preserves the existing API workflow while adapting unit selection from a native select to radio-backed segmented controls.

State handling:

- Unit preference remains stored under `didactic-waddle.units`.
- Last successful city remains stored under `didactic-waddle.city`.
- `setStatus` maps idle, loading, success, and error tones to explicit CSS classes while continuing to write messages with `textContent`.
- `setBusy` disables city input, search, refresh, and unit radios during in-flight requests and exposes `aria-busy` on the form and dashboard.

Security and privacy:

- No new external scripts, analytics, precise location capture, credentials, or third-party assets were introduced.
- API requests still use `URLSearchParams`.
- The only `innerHTML` path remains the existing internal weather-icon renderer, based on normalized weather codes rather than untrusted HTML.

Startup fix:

- `src/server.js` now uses a realpath-normalized direct-run check so `npm.cmd start` correctly starts the server from the sandboxed workspace path.
- `test/server.test.js` covers the direct-run predicate to prevent the entrypoint from silently exiting again.

## Frontend Request Lifecycle Fix

Request date: 2026-05-01

Root cause:

- The latest `origin/main` contained two Python-style `#` lines inside `src/weatherService.js`, which made the module invalid JavaScript and removed required forecast query parameters.
- `loadWeather` stored only the latest controller in shared state.
- The timeout callback and `finally` block referenced shared request state instead of the request they belonged to.
- When a second search aborted the first, the first request could still set a timeout error and call `setBusy(false)` while the second request was active.

Design:

- Restore `buildForecastUrl` so `current` and `daily` Open-Meteo field lists are set with valid JavaScript.
- Create a local `AbortController` per `loadWeather` call and assign it as the active controller.
- Bind the per-request timeout to that local controller.
- Gate render, status, and busy-state updates with `isActiveRequest(controller)`.
- Clear the active controller only when the completing request is still current.
- Abort any active request before reporting invalid city input so stale responses cannot render after user correction.

Security and operational impact:

- No new trust boundary, dependency, secret, storage key, API route, or provider parameter was added.
- The change reduces stale UI state without altering server-side validation or provider error handling.
