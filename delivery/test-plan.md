# Test Plan

Date: 2026-04-29

## Automated Checks

- `npm.cmd test`: passed on 2026-04-29 with 14 Node unit, route, and startup failure tests.
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
