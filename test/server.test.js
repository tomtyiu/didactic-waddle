import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { createRateLimiter, createRequestHandler } from "../src/server.js";

test("GET /api/health returns service status", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.url}/api/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
    assert.equal(typeof payload.uptimeSeconds, "number");
  } finally {
    await server.close();
  }
});

test("GET /api/weather returns normalized weather JSON", async () => {
  const server = await startTestServer({
    fetchImpl: createMockFetch([
      {
        body: {
          results: [
            {
              id: 5809844,
              name: "Seattle",
              admin1: "Washington",
              country: "United States",
              country_code: "US",
              latitude: 47.6062,
              longitude: -122.3321,
              timezone: "America/Los_Angeles"
            }
          ]
        }
      },
      {
        body: {
          current_units: {
            temperature_2m: "\u00b0F",
            wind_speed_10m: "mph",
            precipitation: "inch",
            surface_pressure: "hPa",
            cloud_cover: "%",
            relative_humidity_2m: "%"
          },
          current: {
            time: "2026-04-29T11:00",
            interval: 900,
            temperature_2m: 62,
            apparent_temperature: 60,
            relative_humidity_2m: 71,
            precipitation: 0,
            rain: 0,
            showers: 0,
            snowfall: 0,
            weather_code: 0,
            cloud_cover: 5,
            surface_pressure: 1015,
            wind_speed_10m: 7,
            wind_direction_10m: 210,
            wind_gusts_10m: 16,
            is_day: 1
          },
          daily_units: {
            precipitation_probability_max: "%"
          },
          daily: {
            time: ["2026-04-29"],
            temperature_2m_max: [66],
            temperature_2m_min: [52],
            precipitation_probability_max: [20],
            sunrise: ["2026-04-29T05:55"],
            sunset: ["2026-04-29T20:16"],
            weather_code: [0],
            wind_speed_10m_max: [15]
          }
        }
      }
    ])
  });

  try {
    const response = await fetch(`${server.url}/api/weather?city=Seattle&units=imperial`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.city.name, "Seattle");
    assert.equal(payload.current.summary, "Clear sky");
    assert.equal(payload.daily.temperatureMax, 66);
    assert.equal(payload.source.name, "Open-Meteo");
  } finally {
    await server.close();
  }
});

test("GET /api/weather rejects unsafe city input", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.url}/api/weather?city=%3Cscript%3E`);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "INVALID_CITY");
    assert.equal(Object.hasOwn(payload, "stack"), false);
  } finally {
    await server.close();
  }
});

test("GET /api/weather enforces rate limiting", async () => {
  const server = await startTestServer({
    rateLimiter: () => ({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 10
    })
  });

  try {
    const response = await fetch(`${server.url}/api/weather?city=Seattle`);
    const payload = await response.json();

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "10");
    assert.equal(payload.error.code, "RATE_LIMITED");
  } finally {
    await server.close();
  }
});

test("createRateLimiter blocks requests beyond the configured max", () => {
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 });

  assert.equal(limiter("client", 100).allowed, true);
  assert.equal(limiter("client", 200).allowed, false);
  assert.equal(limiter("client", 1200).allowed, true);
});

async function startTestServer(options = {}) {
  const server = createServer(createRequestHandler(options));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.close();
      await once(server, "close");
    }
  };
}

function createMockFetch(responses) {
  const queue = [...responses];

  return async () => {
    const next = queue.shift();

    if (!next) {
      throw new Error("Unexpected fetch call");
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };
}
