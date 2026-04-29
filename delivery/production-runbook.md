# Production Runbook

Date: 2026-04-29

## Startup

Install Node.js 20 or newer. From the repository root:

```powershell
npm.cmd start
```

Optional configuration:

```powershell
$env:PORT = "3001"
$env:HOST = "0.0.0.0"
$env:WEATHER_TIMEOUT_MS = "6000"
$env:RATE_LIMIT_WINDOW_MS = "60000"
$env:RATE_LIMIT_MAX = "60"
npm.cmd start
```

If the default port is occupied during local review, bind to loopback with an alternate port:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "3101"
npm.cmd start
```

## Health Checks

```powershell
Invoke-WebRequest http://localhost:3001/api/health
Invoke-WebRequest "http://localhost:3001/api/weather?city=Seattle&units=imperial"
```

Expected health response includes `status: "ok"` and `uptimeSeconds`.

## Diagnostics

- Check server logs for startup messages and sanitized weather lookup failures.
- If startup prints `server_start_failed` with `EADDRINUSE`, stop the process already using the configured port or set `PORT` to an available port.
- Check browser developer tools for failed `/api/weather` calls.
- Verify Open-Meteo availability if many `502` responses occur.
- Inspect rate-limit settings if clients receive `429` responses unexpectedly.

## Common Failures

- Startup `EADDRINUSE`: configured `HOST` and `PORT` are already occupied.
- `400`: city input is empty, too long, or contains unsupported characters.
- `404`: Open-Meteo did not return a matching city.
- `429`: client exceeded the in-memory rate limit.
- `502`: provider request failed, timed out, or returned unexpected data.

## Recovery

- For provider outages, keep the service running and monitor recovery; users receive safe retry messages.
- For startup port conflicts, stop the conflicting process or relaunch with a different `PORT`.
- For repeated timeouts, temporarily increase `WEATHER_TIMEOUT_MS` within operational tolerance.
- For accidental rate-limit pressure, adjust `RATE_LIMIT_MAX` or deploy shared rate limiting for multi-instance production.
- For application regressions, revert the PR or redeploy the previous commit.
