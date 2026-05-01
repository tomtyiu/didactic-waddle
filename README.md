# Didactic Waddle
## Weather by City application using AI SDLC tool using OpenAI's Codex. 
A dependency-free Node.js full-stack weather app. Users enter a city, the backend resolves it with Open-Meteo geocoding, fetches current weather and day-planning details, and the frontend renders a responsive dashboard.

## Run Locally

```powershell
npm.cmd start
```

Open `http://localhost:3001`.
or
http://127.0.0.1:3001

## Test

```powershell
npm.cmd test
npm.cmd run check
```

## Maintenance

```powershell
npm.cmd run maintenance:security
npm.cmd run maintenance:branch
npm.cmd run maintenance:check
```

- `maintenance:security` scans code and configuration for high-confidence security blockers and review-worthy attack-surface changes.
- `maintenance:branch` reports the current branch, upstream, ahead/behind state, local `main` freshness, and untracked files before starting work or opening a PR.
- `maintenance:check` runs both maintenance checks. Use `-- --strict` with either underlying command to fail on review warnings.

## API

- `GET /api/health`
- `GET /api/weather?city=Seattle&units=imperial`

`units` may be `imperial` or `metric`; omitted or invalid values default to `imperial`.

## Configuration

- `PORT`: server port, default `3001`.
- `HOST`: bind host, default `0.0.0.0`.
- `WEATHER_TIMEOUT_MS`: Open-Meteo timeout, default `6000`.
- `RATE_LIMIT_WINDOW_MS`: rate-limit window, default `60000`.
- `RATE_LIMIT_MAX`: requests per client per window, default `60`.

Weather and location data are provided by Open-Meteo.
