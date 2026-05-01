# Plan

Date: 2026-04-29

## Request Summary

As a user, I want to view real-time weather data for my city so that I can plan my day. Deliver a full software stack and open a pull request against `tomtyiu/didactic-waddle`.

## Scope

- Create a Node.js backend that serves static frontend assets and exposes a weather API.
- Use Open-Meteo geocoding and forecast APIs, which do not require secrets.
- Build a city-search frontend with current conditions, daily planning details, refresh behavior, loading state, and error state.
- Add tests, documentation, release notes, and rollback guidance.
- Push a branch and create a PR.

## Non-Goals

- User accounts, authentication, saved profiles, or paid weather-provider integration.
- Long-range forecast, severe-weather alerts, or push notifications.
- Production deployment from this workspace unless deployment credentials and target environment are provided.

## Milestones

1. Define requirements, design, validation, and release plan.
2. Implement backend weather aggregation with input validation, request timeout, rate limiting, and normalized responses.
3. Implement frontend city workflow, responsive layout, auto-refresh, and accessible states.
4. Add automated tests for validation, provider mapping, and API behavior.
5. Run local validation and smoke checks.
6. Commit, push branch, and create PR.

## Risks and Mitigations

- External API outage or slow response: backend uses timeout, bounded errors, and clear client messages.
- Ambiguous city names: backend selects the best Open-Meteo result and returns the resolved city, region, and country.
- Abuse through untrusted city input: input is length-limited, character-filtered, URL-encoded, and never executed as code.
- Secret exposure: no API keys or secrets are required.
- Empty baseline repository: keep the stack minimal and dependency-free so setup remains reproducible.

## Completion Criteria

- `npm.cmd test` passes.
- `npm.cmd run check` passes.
- Local smoke check can load the frontend and return weather JSON for a representative city.
- Delivery docs describe validation, release, rollback, and residual risks.
- Branch is pushed and a PR is created.

## UI Professionalization Addendum

Request date: 2026-04-29

Target outcome: improve the existing browser UI without changing the backend API contract, storage keys, or provider integration.

Scope:

- Refine `public/index.html`, `public/styles.css`, and narrowly related frontend behavior in `public/app.js`.
- Improve visual hierarchy, spacing, responsive layout, form controls, status states, and weather dashboard presentation.
- Preserve current search, refresh, unit preference, local storage, and error-handling behavior.

Non-goals:

- No backend weather contract changes.
- No new runtime dependencies or external UI asset downloads.
- No authentication, saved accounts, maps, alerts, or long-range forecast expansion.

Execution steps:

1. Capture UI-specific requirements and validation expectations.
2. Update the static markup for a more professional app shell and accessible controls.
3. Rework CSS for a polished responsive dashboard, stronger hierarchy, and durable text fitting.
4. Adjust frontend JavaScript only where markup and state classes require it.
5. Run syntax checks, automated tests, and local smoke checks.
6. Update delivery docs with validation evidence and release notes.

## Frontend Request Race Debug Addendum

Request date: 2026-05-01

Target outcome: preserve correct UI state when a user submits a second city search before the first `/api/weather` request has completed.

Scope:

- Restore the latest `src/weatherService.js` main-branch regression where required forecast query parameters were changed into invalid JavaScript `#` lines.
- Fix `public/app.js` request-controller handling.
- Add focused regression coverage in `test/frontend.test.js`.
- Keep the backend API contract, Open-Meteo integration, storage keys, and visual design unchanged.

Non-goals:

- No new browser dependencies or test frameworks.
- No backend route or provider behavior changes.
- No production deployment from this workspace.

Execution steps:

1. Reproduce the race with a pending first request and a second submitted search.
2. Scope each abort timeout and UI update to its own `AbortController`.
3. Prevent superseded requests from writing status or clearing busy state.
4. Add the frontend regression test to `npm.cmd test` and `npm.cmd run check`.
5. Re-run targeted frontend validation, full automated validation, and runtime smoke checks.

Completion criteria:

- `src/weatherService.js` parses and `buildForecastUrl` continues to include `current` and `daily` Open-Meteo fields.
- A superseded request cannot re-enable controls or replace the active loading status.
- The active request still renders the successful weather response.
- `npm.cmd run check`, `npm.cmd test`, and local runtime smoke checks pass.

## Maintenance Automation Addendum

Request date: 2026-05-01

Target outcome: implement recommendation 6 and 7 from the maintenance automation review: security-surface scanning and branch hygiene automation.

Scope:

- Add dependency-free local maintenance scripts under `scripts/`.
- Wire the checks into `package.json`.
- Update README and delivery docs with usage, validation, release, and rollback notes.

Non-goals:

- No scheduled jobs, GitHub Actions, package dependencies, network calls, or production deployment changes.
- No automatic branch mutation, fetch, commit, push, cleanup, or destructive Git behavior.

Execution steps:

1. Add a read-only security-surface scanner that distinguishes blockers from review findings.
2. Add a read-only branch hygiene reporter for Git state and untracked files.
3. Include script syntax in `npm.cmd run check`.
4. Validate both maintenance commands, existing tests, and whitespace.
5. Commit, push, and open a PR if GitHub access is available.

Completion criteria:

- `npm.cmd run maintenance:security` reports zero blockers.
- `npm.cmd run maintenance:branch` reports real Git metadata when Git execution is allowed.
- `npm.cmd run maintenance:check`, `npm.cmd run check`, and `npm.cmd test` pass.
