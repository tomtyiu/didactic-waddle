const form = document.querySelector("#weather-form");
const cityInput = document.querySelector("#city-input");
const unitInputs = [...document.querySelectorAll("input[name='units']")];
const refreshButton = document.querySelector("#refresh-button");
const searchButton = form.querySelector("button[type='submit']");
const statusEl = document.querySelector("#status");
const dashboard = document.querySelector("#weather-dashboard");

const fields = {
  visual: document.querySelector("#condition-visual"),
  locationName: document.querySelector("#location-name"),
  conditionText: document.querySelector("#condition-text"),
  currentTemp: document.querySelector("#current-temp"),
  feelsLike: document.querySelector("#feels-like"),
  humidity: document.querySelector("#humidity"),
  wind: document.querySelector("#wind"),
  precipitation: document.querySelector("#precipitation"),
  cloudCover: document.querySelector("#cloud-cover"),
  pressure: document.querySelector("#pressure"),
  gusts: document.querySelector("#gusts"),
  dailyHigh: document.querySelector("#daily-high"),
  dailyLow: document.querySelector("#daily-low"),
  rainChance: document.querySelector("#rain-chance"),
  sunrise: document.querySelector("#sunrise"),
  sunset: document.querySelector("#sunset"),
  updatedAt: document.querySelector("#updated-at")
};

const STORAGE_KEYS = {
  city: "didactic-waddle.city",
  units: "didactic-waddle.units"
};

const state = {
  lastCity: readPreference(STORAGE_KEYS.city) ?? "",
  units: readPreference(STORAGE_KEYS.units) ?? "imperial",
  refreshTimer: null,
  currentController: null
};

cityInput.value = state.lastCity;
setSelectedUnits(state.units);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadWeather(cityInput.value, { reason: "search" });
});

refreshButton.addEventListener("click", () => {
  loadWeather(state.lastCity || cityInput.value, { reason: "refresh" });
});

unitInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) {
      return;
    }

    state.units = getSelectedUnits();
    savePreference(STORAGE_KEYS.units, state.units);

    if (state.lastCity) {
      loadWeather(state.lastCity, { reason: "units" });
    }
  });
});

if (state.lastCity) {
  loadWeather(state.lastCity, { reason: "initial" });
}

async function loadWeather(city, options = {}) {
  const normalizedCity = city.trim();

  if (normalizedCity.length < 2) {
    setStatus("Enter at least two characters for the city.", "error");
    return;
  }

  state.currentController?.abort();
  state.currentController = new AbortController();

  setBusy(true);
  setStatus(options.reason === "refresh" ? "Refreshing weather..." : "Loading current weather...", "loading");

  const timeout = setTimeout(() => state.currentController.abort(), 9000);

  try {
    const params = new URLSearchParams({
      city: normalizedCity,
      units: getSelectedUnits()
    });
    const response = await fetch(`/api/weather?${params.toString()}`, {
      signal: state.currentController.signal,
      headers: {
        "accept": "application/json"
      }
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Weather lookup failed.");
    }

    state.lastCity = normalizedCity;
    state.units = getSelectedUnits();
    savePreference(STORAGE_KEYS.city, normalizedCity);
    savePreference(STORAGE_KEYS.units, state.units);

    renderWeather(payload);
    scheduleRefresh();
    setStatus("Current weather loaded.", "success");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("The weather request timed out. Try refreshing in a moment.", "error");
    } else {
      setStatus(error.message || "Weather lookup failed.", "error");
    }
  } finally {
    clearTimeout(timeout);
    setBusy(false);
  }
}

function renderWeather(data) {
  dashboard.hidden = false;
  refreshButton.disabled = false;

  const locationParts = [data.city.name, data.city.admin1, data.city.country].filter(Boolean);
  fields.locationName.textContent = locationParts.join(", ");
  fields.conditionText.textContent = data.current.summary;
  fields.currentTemp.textContent = formatValue(data.current.temperature, data.units.temperature, { maximumFractionDigits: 0 });
  fields.feelsLike.textContent = `Feels like ${formatValue(data.current.apparentTemperature, data.units.temperature, { maximumFractionDigits: 0 })}`;
  fields.humidity.textContent = formatValue(data.current.humidity, data.units.humidity, { maximumFractionDigits: 0 });
  fields.wind.textContent = `${formatValue(data.current.windSpeed, data.units.windSpeed, { maximumFractionDigits: 0 })} ${formatCompass(data.current.windDirection)}`;
  fields.precipitation.textContent = formatValue(data.current.precipitation, data.units.precipitation, { maximumFractionDigits: 2 });
  fields.cloudCover.textContent = formatValue(data.current.cloudCover, data.units.cloudCover, { maximumFractionDigits: 0 });
  fields.pressure.textContent = formatValue(data.current.pressure, data.units.pressure, { maximumFractionDigits: 0 });
  fields.gusts.textContent = formatValue(data.current.windGusts, data.units.windSpeed, { maximumFractionDigits: 0 });
  fields.dailyHigh.textContent = formatValue(data.daily.temperatureMax, data.units.temperature, { maximumFractionDigits: 0 });
  fields.dailyLow.textContent = formatValue(data.daily.temperatureMin, data.units.temperature, { maximumFractionDigits: 0 });
  fields.rainChance.textContent = formatValue(data.daily.precipitationProbabilityMax, data.daily.precipitationProbabilityUnit, { maximumFractionDigits: 0 });
  fields.sunrise.textContent = formatClock(data.daily.sunrise);
  fields.sunset.textContent = formatClock(data.daily.sunset);
  fields.updatedAt.textContent = `Updated ${formatDateTime(data.fetchedAt)} from ${data.source.name}`;
  fields.visual.innerHTML = renderWeatherIcon(data.current.weatherCode, data.current.isDay);
}

function setBusy(isBusy) {
  form.setAttribute("aria-busy", String(isBusy));
  dashboard.setAttribute("aria-busy", String(isBusy));
  searchButton.disabled = isBusy;
  refreshButton.disabled = isBusy || !state.lastCity;
  cityInput.disabled = isBusy;
  unitInputs.forEach((input) => {
    input.disabled = isBusy;
  });
}

function setStatus(message, tone) {
  const normalizedTone = ["loading", "success", "error"].includes(tone) ? tone : "idle";
  statusEl.textContent = message;
  statusEl.className = `status is-${normalizedTone}`;
}

function getSelectedUnits() {
  const selected = unitInputs.find((input) => input.checked)?.value;
  return selected === "metric" ? "metric" : "imperial";
}

function setSelectedUnits(value) {
  const normalized = value === "metric" ? "metric" : "imperial";
  unitInputs.forEach((input) => {
    input.checked = input.value === normalized;
  });
}

function scheduleRefresh() {
  window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(() => {
    if (state.lastCity) {
      loadWeather(state.lastCity, { reason: "refresh" });
    }
  }, 10 * 60 * 1000);
}

function formatValue(value, unit, options = {}) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: options.maximumFractionDigits ?? 1
  }).format(value);

  return `${formatted}${unit}`;
}

function formatCompass(degrees) {
  if (!Number.isFinite(degrees)) {
    return "";
  }

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % directions.length];
}

function formatClock(value) {
  const match = String(value ?? "").match(/T(\d{2}):(\d{2})/);
  if (!match) {
    return "--";
  }

  let hour = Number.parseInt(match[1], 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function renderWeatherIcon(code, isDay) {
  const numericCode = Number(code);
  const sky = isDay ? "#d7ecf5" : "#233142";
  const sun = isDay ? "#f2b84b" : "#e7edf4";
  const cloud = isDay ? "#ffffff" : "#d9e1e8";
  const rain = "#4f86c6";
  const snow = "#8fbdd9";
  const storm = "#5a5f73";

  if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].includes(numericCode)) {
    return `<svg viewBox="0 0 160 160" role="img" aria-label="Rainy conditions">
      <rect width="160" height="160" rx="18" fill="${sky}"></rect>
      <circle cx="54" cy="50" r="24" fill="${sun}"></circle>
      <path d="M48 96h68c17 0 30-12 30-28s-13-28-29-28c-6-16-21-26-39-26-22 0-40 16-43 37C20 53 10 64 10 79c0 10 7 17 20 17h18z" fill="${cloud}"></path>
      <path d="M50 114l-10 18M82 114l-10 18M114 114l-10 18" stroke="${rain}" stroke-width="9" stroke-linecap="round"></path>
    </svg>`;
  }

  if ([71, 73, 75, 77, 85, 86].includes(numericCode)) {
    return `<svg viewBox="0 0 160 160" role="img" aria-label="Snowy conditions">
      <rect width="160" height="160" rx="18" fill="${sky}"></rect>
      <path d="M46 92h70c17 0 29-12 29-28 0-15-12-27-28-28C111 21 96 12 79 12 58 12 40 28 37 49 21 51 10 63 10 78c0 9 8 14 22 14h14z" fill="${cloud}"></path>
      <circle cx="48" cy="120" r="6" fill="${snow}"></circle>
      <circle cx="82" cy="126" r="6" fill="${snow}"></circle>
      <circle cx="116" cy="120" r="6" fill="${snow}"></circle>
    </svg>`;
  }

  if ([95, 96, 99].includes(numericCode)) {
    return `<svg viewBox="0 0 160 160" role="img" aria-label="Stormy conditions">
      <rect width="160" height="160" rx="18" fill="${sky}"></rect>
      <path d="M44 86h72c17 0 29-12 29-28 0-15-12-27-28-28C111 16 96 8 79 8 58 8 40 24 37 45 21 47 10 59 10 74c0 8 8 12 22 12h12z" fill="${storm}"></path>
      <path d="M78 88l-16 34h24l-9 28 32-44H85l12-18z" fill="${sun}"></path>
    </svg>`;
  }

  if ([45, 48].includes(numericCode)) {
    return `<svg viewBox="0 0 160 160" role="img" aria-label="Foggy conditions">
      <rect width="160" height="160" rx="18" fill="${sky}"></rect>
      <path d="M45 78h68c16 0 27-11 27-25s-11-25-26-25c-6-14-20-22-36-22-20 0-37 14-40 33-14 2-24 12-24 25 0 9 9 14 31 14z" fill="${cloud}"></path>
      <path d="M28 104h102M18 124h118M38 142h86" stroke="#8aa1a9" stroke-width="9" stroke-linecap="round"></path>
    </svg>`;
  }

  if ([1, 2, 3].includes(numericCode)) {
    return `<svg viewBox="0 0 160 160" role="img" aria-label="Partly cloudy conditions">
      <rect width="160" height="160" rx="18" fill="${sky}"></rect>
      <circle cx="58" cy="55" r="30" fill="${sun}"></circle>
      <path d="M51 106h67c17 0 29-12 29-28s-13-28-29-28c-6-15-21-25-38-25-22 0-40 16-42 37-15 2-26 13-26 28 0 10 9 16 39 16z" fill="${cloud}"></path>
    </svg>`;
  }

  return `<svg viewBox="0 0 160 160" role="img" aria-label="Clear conditions">
    <rect width="160" height="160" rx="18" fill="${sky}"></rect>
    <circle cx="80" cy="80" r="38" fill="${sun}"></circle>
    <path d="M80 18v20M80 122v20M18 80h20M122 80h20M36 36l14 14M110 110l14 14M124 36l-14 14M50 110l-14 14" stroke="${sun}" stroke-width="9" stroke-linecap="round"></path>
  </svg>`;
}

function readPreference(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in private or restricted browser modes.
  }
}
