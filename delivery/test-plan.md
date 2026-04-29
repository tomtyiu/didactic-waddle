# Test Plan

Date: 2026-04-29

## Automated Checks

- `npm.cmd test`: passed on 2026-04-29 with 15 Node unit, route, startup entrypoint, and startup failure tests.
- `npm.cmd run check`: passed on 2026-04-29 for JavaScript source, public script, and tests.

## Coverage Targets

- City validation rejects empty, too-long, and unsafe values.
- Unit validation defaults safely and accepts `imperial` or `metric`.
- Weather-code mapping returns useful text.
- Weather service handles geocoding success, no match, and provider failure.
- API route returns normalized successful JSON with mocked provider calls.
- API route returns bounded errors for invalid city and rate-limit cases.
- Startup path logs `EADDRINUSE` port conflicts with structured details instead of throwing an unhandled EventEmitter error.

## Manual Smoke Checks

- Start with `npm.cmd start`.
- Open `http://localhost:3001`.
- Search for `Seattle`.
- Verify resolved city, current temperature, daily planning details, source, and last-updated time render.
- Toggle units and verify unit labels update.
- Refresh and verify the page keeps the selected city.
- Call `http://localhost:3001/api/health`.

## Integration Checks

- Frontend smoke passed on 2026-04-29: local server returned `200` for `/` with the expected `City Weather` document and `/app.js` script reference.
- Real external provider check passed on 2026-04-29: local server returned `200` for `/api/health` and `200` for `/api/weather?city=Seattle&units=imperial` with source `Open-Meteo`.
- Sandbox-only provider access initially returned `502`; rerunning with approved network access confirmed the product path works.

## Security-Focused Checks

- Call `/api/weather?city=` and expect `400`.
- Call `/api/weather?city=<script>` URL-encoded and expect `400`.
- Confirm responses do not include stack traces.
- Start a second server on an occupied port and confirm logs include `server_start_failed` with `EADDRINUSE`, host, and port but no stack.
- Confirm no secrets or API keys are present in code or logs.

## Known Gaps

- No browser automation is required for the initial stack, but a local manual browser smoke check should be performed before production deployment.
- Rate limiting is in-memory and suitable for a single Node process; distributed production deployments should move this to shared infrastructure.

## UI Professionalization Validation

Automated checks to run after the UI pass:

- `npm.cmd run check` to validate `public/app.js` and server/test syntax. Passed on 2026-04-29.
- `npm.cmd test` to confirm API behavior, rate limiting, validation, and startup handling still pass. Passed on 2026-04-29 with 15 passing tests.

Local smoke checks:

- Start the app with `npm.cmd start`.
- Request `/` and confirm the updated HTML is served. Passed on 2026-04-29 with `200 text/html; charset=utf-8`.
- Request `/styles.css` and `/app.js` and confirm both return `200`. Passed on 2026-04-29 with CSS and JavaScript content types.
- Load `/api/health` to confirm the server stays healthy. Passed on 2026-04-29 with `200 application/json; charset=utf-8`.
- Local review server started on 2026-04-29 at `http://127.0.0.1:3101` because port `3001` was already owned by another Node process in this environment.
- If network access is available, search for `Seattle` in the browser or request `/api/weather?city=Seattle&units=imperial`.

Security-focused UI checks:

- Confirm the UI introduces no external scripts, analytics, or secret configuration.
- Confirm API calls continue to use `URLSearchParams`.
- Confirm status rendering uses `textContent` for provider and error messages.

Validation limitation:

- Browser automation through the Browser plugin was unavailable because the Node REPL execution tool was not exposed in this session.
- A headless Edge render check was attempted with a temporary mocked weather endpoint. The first sandboxed run was blocked with `EPERM`; the escalated run timed out and was cleaned up by stopping only the identified temporary `dw-edge-*` Edge processes and matching inline Node process.
- Because of that tooling limitation, visual browser verification should still be performed manually before production deployment.
