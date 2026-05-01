# Requirements

Date: 2026-04-29

## Objective

Enable a user to enter a city and view current weather details quickly enough to plan the day.

## Actors and Systems

- Actor: end user using a browser.
- Frontend: static HTML, CSS, and JavaScript served by the Node backend.
- Backend: Node.js HTTP server.
- External systems: Open-Meteo geocoding API and forecast API.

## Functional Requirements

- User can enter a city name and request weather.
- App displays resolved city, region or country, current temperature, apparent temperature, condition summary, humidity, wind, precipitation, cloud cover, pressure, sunrise, sunset, daily high, daily low, and last-updated time.
- User can switch between imperial and metric units.
- User can refresh the latest weather for the selected city.
- App remembers the last successful city locally in the browser.
- Backend exposes `GET /api/weather?city=<city>&units=<imperial|metric>`.
- Backend exposes `GET /api/health`.

## Non-Functional Requirements

- The app must run locally with a single `npm.cmd start` command.
- The frontend must be responsive for mobile and desktop layouts.
- The backend should avoid runtime dependencies unless needed.
- External API calls must use timeouts.
- API responses must be normalized and stable for the frontend.

## Security Requirements

- City input is trimmed, length-limited, character-filtered, and URL-encoded.
- The server must not execute user input or interpolate it into shell commands.
- The server must not require, store, or log API secrets.
- Error responses must not expose stack traces or sensitive process details.
- The weather API must have basic per-client rate limiting.

## Reliability and Failure Requirements

- Startup listen failures, including a port already in use, must be handled with a clear diagnostic instead of an unhandled Node `events` crash.
- Empty, malformed, or too-long city values return `400`.
- Missing city matches return `404`.
- External timeout or provider failure returns `502` with a safe client message.
- Rate-limit excess returns `429`.
- Frontend must show a useful error message and keep the last successful result visible when refresh fails.

## Observability Requirements

- Backend logs startup and weather lookup failures without logging secrets.
- Startup failure logs include the event name, code, host, port, and safe message without stack traces.
- Health endpoint returns process uptime and status.
- Frontend shows when the data was last fetched.

## Acceptance Criteria

- A request for `Seattle` returns a successful weather payload with normalized `city`, `current`, `daily`, `units`, `source`, and `fetchedAt` fields.
- Invalid city input such as an empty string or disallowed characters is rejected.
- Frontend search renders weather details and resolved location.
- Unit switching changes displayed unit labels and calls the backend with the selected unit system.
- Automated tests cover validation and API success/error paths using mocked fetch calls.
- Automated tests cover port-conflict startup handling so the service reports `EADDRINUSE` cleanly.
- Automated tests cover server entrypoint detection so `npm.cmd start` does not silently exit in sandboxed or symlinked workspaces.

## UI Professionalization Requirements

Functional:

- The first screen must present the city search as the primary task without a marketing landing page.
- The user must be able to search, refresh, and switch units from a clear command area.
- Loaded weather must emphasize location, condition, current temperature, and apparent temperature before secondary metrics.
- Status messages must distinguish idle, loading, success, and error states visually and through `role="status"`.
- The refresh control must remain unavailable until there is a successful city to refresh.

Non-functional:

- The UI must be responsive from narrow mobile widths through desktop without overlapping text or controls.
- Text in buttons, metric tiles, and dashboard panels must wrap or constrain safely.
- The palette must use restrained neutral surfaces with multiple supporting accents rather than a single-hue theme.
- The implementation must remain dependency-free and compatible with the existing static asset server.

Security and privacy:

- The frontend must keep using `URLSearchParams` for API requests.
- Local storage remains limited to the last successful city and unit preference.
- No secrets, precise user location collection, analytics, or third-party UI scripts are introduced.

UI acceptance criteria:

- `/` serves a polished weather app shell with accessible labels for city input, units, search, and refresh.
- A successful weather response renders the dashboard without changing the `/api/weather` contract.
- Loading, success, and error status classes are applied consistently.
- `npm.cmd run check` validates the updated browser script syntax.
- `npm.cmd test` confirms backend behavior remains unchanged.

## Frontend Request Lifecycle Requirements

Request date: 2026-05-01

Functional:

- Forecast URL construction must include the required `current` and `daily` Open-Meteo field lists using valid JavaScript statements.
- Submitting a new city search must abort any in-flight weather request.
- A superseded request must not update status text, render weather, or clear busy state for the active request.
- The active request must remain able to render weather and restore controls when it completes.
- Submitting invalid city input must stop any active request and show the validation error.

Security and reliability:

- The fix must keep using `AbortController` and `URLSearchParams`; no new external scripts or dependencies are introduced.
- Provider and validation error messages must continue to render through `textContent`.
- Existing backend input validation, rate limiting, and safe error responses remain unchanged.

Acceptance criteria:

- Syntax checks catch invalid JavaScript in `src/weatherService.js`.
- Existing weather service tests confirm `buildForecastUrl` includes documented forecast parameters.
- A regression test proves rapid consecutive searches keep the UI busy for the second request after the first is aborted.
- The full Node test suite passes with the new frontend regression included.
- Runtime smoke checks for `/`, `/api/health`, and `/api/weather?city=Seattle&units=imperial` pass when provider network access is available.
