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

- Empty, malformed, or too-long city values return `400`.
- Missing city matches return `404`.
- External timeout or provider failure returns `502` with a safe client message.
- Rate-limit excess returns `429`.
- Frontend must show a useful error message and keep the last successful result visible when refresh fails.

## Observability Requirements

- Backend logs startup and weather lookup failures without logging secrets.
- Health endpoint returns process uptime and status.
- Frontend shows when the data was last fetched.

## Acceptance Criteria

- A request for `Seattle` returns a successful weather payload with normalized `city`, `current`, `daily`, `units`, `source`, and `fetchedAt` fields.
- Invalid city input such as an empty string or disallowed characters is rejected.
- Frontend search renders weather details and resolved location.
- Unit switching changes displayed unit labels and calls the backend with the selected unit system.
- Automated tests cover validation and API success/error paths using mocked fetch calls.
