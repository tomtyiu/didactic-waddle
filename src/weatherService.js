const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUT_MS = 6000;
const MAX_CITY_LENGTH = 80;
const CITY_PATTERN = /^[\p{L}\p{M}\d\s.',-]+$/u;

const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m"
];

const DAILY_FIELDS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "sunrise",
  "sunset",
  "weather_code",
  "wind_speed_10m_max"
];

export class WeatherServiceError extends Error {
  constructor(message, statusCode = 500, code = "WEATHER_ERROR") {
    super(message);
    this.name = "WeatherServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeUnits(units) {
  return units === "metric" ? "metric" : "imperial";
}

export function validateCity(city) {
  if (typeof city !== "string") {
    throw new WeatherServiceError("Enter a city name.", 400, "INVALID_CITY");
  }

  const normalized = city.trim().replace(/\s+/g, " ");

  if (normalized.length < 2) {
    throw new WeatherServiceError("Enter at least two characters for the city.", 400, "INVALID_CITY");
  }

  if (normalized.length > MAX_CITY_LENGTH) {
    throw new WeatherServiceError("City names must be 80 characters or fewer.", 400, "INVALID_CITY");
  }

  if (!CITY_PATTERN.test(normalized)) {
    throw new WeatherServiceError("City names can include letters, numbers, spaces, commas, periods, apostrophes, and hyphens.", 400, "INVALID_CITY");
  }

  return normalized;
}

export function describeWeatherCode(code) {
  if (code === null || code === undefined || code === "") {
    return "Weather data available";
  }

  const numericCode = Number(code);

  if (!Number.isFinite(numericCode)) {
    return "Weather data available";
  }

  if (numericCode === 0) return "Clear sky";
  if ([1, 2, 3].includes(numericCode)) return "Mainly clear to overcast";
  if ([45, 48].includes(numericCode)) return "Fog";
  if ([51, 53, 55].includes(numericCode)) return "Drizzle";
  if ([56, 57].includes(numericCode)) return "Freezing drizzle";
  if ([61, 63, 65].includes(numericCode)) return "Rain";
  if ([66, 67].includes(numericCode)) return "Freezing rain";
  if ([71, 73, 75].includes(numericCode)) return "Snow";
  if (numericCode === 77) return "Snow grains";
  if ([80, 81, 82].includes(numericCode)) return "Rain showers";
  if ([85, 86].includes(numericCode)) return "Snow showers";
  if (numericCode === 95) return "Thunderstorm";
  if ([96, 99].includes(numericCode)) return "Thunderstorm with hail";

  return "Weather data available";
}

export async function fetchWeatherForCity(cityInput, options = {}) {
  const city = validateCity(cityInput);
  const units = normalizeUnits(options.units);
  const timeoutMs = normalizeTimeout(options.timeoutMs ?? process.env.WEATHER_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new WeatherServiceError("Weather fetch is not available in this runtime.", 500, "FETCH_UNAVAILABLE");
  }

  const location = await geocodeCity(city, { fetchImpl, timeoutMs });
  const forecast = await fetchForecast(location, units, { fetchImpl, timeoutMs });

  return normalizeForecast(location, forecast, units);
}

export function buildGeocodingUrl(city) {
  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  return url;
}

export function buildForecastUrl(location, units) {
  const unitSystem = normalizeUnits(units);
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
#  url.searchParams.set("current", CURRENT_FIELDS.join(","));
#  url.searchParams.set("daily", DAILY_FIELDS.join(","));
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("temperature_unit", unitSystem === "metric" ? "celsius" : "fahrenheit");
  url.searchParams.set("wind_speed_unit", unitSystem === "metric" ? "kmh" : "mph");
  url.searchParams.set("precipitation_unit", unitSystem === "metric" ? "mm" : "inch");
  return url;
}

async function geocodeCity(city, options) {
  const payload = await fetchJson(buildGeocodingUrl(city), options);
  const results = Array.isArray(payload.results) ? payload.results : [];
  const match = results.find((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude));

  if (!match) {
    throw new WeatherServiceError("No matching city was found.", 404, "CITY_NOT_FOUND");
  }

  return {
    id: match.id ?? null,
    name: match.name,
    admin1: match.admin1 ?? "",
    country: match.country ?? "",
    countryCode: match.country_code ?? "",
    latitude: match.latitude,
    longitude: match.longitude,
    timezone: match.timezone ?? ""
  };
}

async function fetchForecast(location, units, options) {
  return fetchJson(buildForecastUrl(location, units), options);
}

async function fetchJson(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        "accept": "application/json",
        "user-agent": "didactic-waddle-weather-app/0.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new WeatherServiceError("Weather provider returned an error.", 502, "PROVIDER_ERROR");
    }

    const payload = await response.json();

    if (payload?.error) {
      throw new WeatherServiceError("Weather provider rejected the request.", 502, "PROVIDER_ERROR");
    }

    return payload;
  } catch (error) {
    if (error instanceof WeatherServiceError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw new WeatherServiceError("Weather provider timed out.", 502, "PROVIDER_TIMEOUT");
    }

    throw new WeatherServiceError("Weather provider is unavailable.", 502, "PROVIDER_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeForecast(location, forecast, units) {
  const current = forecast.current;
  const daily = forecast.daily;

  if (!current || !daily || !Number.isFinite(current.temperature_2m)) {
    throw new WeatherServiceError("Weather provider returned an unexpected response.", 502, "PROVIDER_RESPONSE_INVALID");
  }

  const currentUnits = forecast.current_units ?? {};
  const dailyUnits = forecast.daily_units ?? {};

  return {
    city: location,
    units: {
      system: normalizeUnits(units),
      temperature: normalizeUnitLabel(currentUnits.temperature_2m, units === "metric" ? "\u00b0C" : "\u00b0F"),
      windSpeed: normalizeUnitLabel(currentUnits.wind_speed_10m, units === "metric" ? "km/h" : "mph"),
      precipitation: normalizeUnitLabel(currentUnits.precipitation, units === "metric" ? "mm" : "inch"),
      pressure: normalizeUnitLabel(currentUnits.surface_pressure, "hPa"),
      cloudCover: normalizeUnitLabel(currentUnits.cloud_cover, "%"),
      humidity: normalizeUnitLabel(currentUnits.relative_humidity_2m, "%")
    },
    current: {
      time: current.time ?? null,
      intervalSeconds: toNullableNumber(current.interval),
      temperature: toNullableNumber(current.temperature_2m),
      apparentTemperature: toNullableNumber(current.apparent_temperature),
      humidity: toNullableNumber(current.relative_humidity_2m),
      precipitation: toNullableNumber(current.precipitation),
      rain: toNullableNumber(current.rain),
      showers: toNullableNumber(current.showers),
      snowfall: toNullableNumber(current.snowfall),
      weatherCode: toNullableNumber(current.weather_code),
      summary: describeWeatherCode(current.weather_code),
      cloudCover: toNullableNumber(current.cloud_cover),
      pressure: toNullableNumber(current.surface_pressure),
      windSpeed: toNullableNumber(current.wind_speed_10m),
      windDirection: toNullableNumber(current.wind_direction_10m),
      windGusts: toNullableNumber(current.wind_gusts_10m),
      isDay: current.is_day === 1
    },
    daily: {
      date: firstValue(daily.time),
      temperatureMax: toNullableNumber(firstValue(daily.temperature_2m_max)),
      temperatureMin: toNullableNumber(firstValue(daily.temperature_2m_min)),
      precipitationProbabilityMax: toNullableNumber(firstValue(daily.precipitation_probability_max)),
      precipitationProbabilityUnit: dailyUnits.precipitation_probability_max ?? "%",
      sunrise: firstValue(daily.sunrise),
      sunset: firstValue(daily.sunset),
      weatherCode: toNullableNumber(firstValue(daily.weather_code)),
      summary: describeWeatherCode(firstValue(daily.weather_code)),
      windSpeedMax: toNullableNumber(firstValue(daily.wind_speed_10m_max))
    },
    source: {
      name: "Open-Meteo",
      url: "https://open-meteo.com/"
    },
    fetchedAt: new Date().toISOString()
  };
}

function normalizeTimeout(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(parsed, 30000);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : null;
}

function toNullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeUnitLabel(value, fallback) {
  if (!value) {
    return fallback;
  }

  return value === "mp/h" ? "mph" : value;
}
