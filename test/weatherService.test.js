import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForecastUrl,
  buildGeocodingUrl,
  describeWeatherCode,
  fetchWeatherForCity,
  normalizeUnits,
  validateCity,
  WeatherServiceError
} from "../src/weatherService.js";

test("validateCity normalizes safe city input", () => {
  assert.equal(validateCity("  New   York, NY  "), "New York, NY");
});

test("validateCity rejects empty, too-short, too-long, and unsafe input", () => {
  assert.throws(() => validateCity(""), /at least two characters/);
  assert.throws(() => validateCity("A"), /at least two characters/);
  assert.throws(() => validateCity("a".repeat(81)), /80 characters/);
  assert.throws(() => validateCity("<script>"), /City names can include/);
});

test("normalizeUnits defaults safely", () => {
  assert.equal(normalizeUnits("metric"), "metric");
  assert.equal(normalizeUnits("imperial"), "imperial");
  assert.equal(normalizeUnits("kelvin"), "imperial");
  assert.equal(normalizeUnits(undefined), "imperial");
});

test("buildGeocodingUrl and buildForecastUrl use documented Open-Meteo parameters", () => {
  const geocodingUrl = buildGeocodingUrl("Seattle");
  assert.equal(geocodingUrl.hostname, "geocoding-api.open-meteo.com");
  assert.equal(geocodingUrl.searchParams.get("name"), "Seattle");
  assert.equal(geocodingUrl.searchParams.get("count"), "5");
  assert.equal(geocodingUrl.searchParams.get("language"), "en");

  const forecastUrl = buildForecastUrl({ latitude: 47.61, longitude: -122.33 }, "metric");
  assert.equal(forecastUrl.hostname, "api.open-meteo.com");
  assert.equal(forecastUrl.searchParams.get("latitude"), "47.61");
  assert.equal(forecastUrl.searchParams.get("longitude"), "-122.33");
  assert.equal(forecastUrl.searchParams.get("temperature_unit"), "celsius");
  assert.match(forecastUrl.searchParams.get("current"), /temperature_2m/);
  assert.match(forecastUrl.searchParams.get("daily"), /sunrise/);
});

test("describeWeatherCode maps known WMO codes", () => {
  assert.equal(describeWeatherCode(0), "Clear sky");
  assert.equal(describeWeatherCode(63), "Rain");
  assert.equal(describeWeatherCode(95), "Thunderstorm");
  assert.equal(describeWeatherCode(999), "Weather data available");
});

test("fetchWeatherForCity returns normalized weather data", async () => {
  const fetchImpl = createMockFetch([
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
          temperature_2m: 62.4,
          apparent_temperature: 61.8,
          relative_humidity_2m: 71,
          precipitation: 0,
          rain: 0,
          showers: 0,
          snowfall: 0,
          weather_code: 3,
          cloud_cover: 80,
          surface_pressure: 1015,
          wind_speed_10m: 7.2,
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
          weather_code: [3],
          wind_speed_10m_max: [15]
        }
      }
    }
  ]);

  const weather = await fetchWeatherForCity("Seattle", { fetchImpl, units: "imperial", timeoutMs: 1000 });

  assert.equal(weather.city.name, "Seattle");
  assert.equal(weather.city.countryCode, "US");
  assert.equal(weather.current.summary, "Mainly clear to overcast");
  assert.equal(weather.current.temperature, 62.4);
  assert.equal(weather.daily.temperatureMax, 66);
  assert.equal(weather.units.system, "imperial");
  assert.equal(weather.source.name, "Open-Meteo");
  assert.equal(fetchImpl.calls.length, 2);
});

test("fetchWeatherForCity reports no city match as 404", async () => {
  const fetchImpl = createMockFetch([{ body: { results: [] } }]);

  await assert.rejects(
    () => fetchWeatherForCity("Notacity", { fetchImpl, timeoutMs: 1000 }),
    (error) => error instanceof WeatherServiceError && error.statusCode === 404 && error.code === "CITY_NOT_FOUND"
  );
});

test("fetchWeatherForCity converts provider failures to safe 502 errors", async () => {
  const fetchImpl = createMockFetch([{ status: 500, body: { error: true } }]);

  await assert.rejects(
    () => fetchWeatherForCity("Seattle", { fetchImpl, timeoutMs: 1000 }),
    (error) => error instanceof WeatherServiceError && error.statusCode === 502 && error.code === "PROVIDER_ERROR"
  );
});

function createMockFetch(responses) {
  const calls = [];
  const queue = [...responses];

  const fetchImpl = async (url) => {
    calls.push(String(url));
    const next = queue.shift();

    if (!next) {
      throw new Error("Unexpected fetch call");
    }

    if (next.error) {
      throw next.error;
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  fetchImpl.calls = calls;
  return fetchImpl;
}
