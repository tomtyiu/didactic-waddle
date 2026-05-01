import assert from "node:assert/strict";
import test from "node:test";

test("superseded weather requests do not clear busy state for the active request", async () => {
  const harness = createFrontendHarness();
  const fetchMock = createPendingFetch();
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const hadDocument = Object.hasOwn(globalThis, "document");
  const hadWindow = Object.hasOwn(globalThis, "window");
  const hadFetch = Object.hasOwn(globalThis, "fetch");

  globalThis.document = harness.document;
  globalThis.window = harness.window;
  globalThis.fetch = fetchMock;

  try {
    await import(`../public/app.js?test=${Date.now()}`);

    harness.cityInput.value = "Seattle";
    harness.form.dispatch("submit", { preventDefault: () => {} });
    assert.equal(fetchMock.calls.length, 1);
    assert.equal(harness.searchButton.disabled, true);

    harness.cityInput.value = "Portland";
    harness.form.dispatch("submit", { preventDefault: () => {} });
    assert.equal(fetchMock.calls.length, 2);

    await settleAsyncWork();

    assert.equal(harness.searchButton.disabled, true);
    assert.equal(harness.refreshButton.disabled, true);
    assert.equal(harness.statusEl.textContent, "Loading current weather...");

    fetchMock.calls[1].resolveJson(createWeatherPayload("Portland"));
    await settleAsyncWork();

    assert.equal(harness.searchButton.disabled, false);
    assert.equal(harness.statusEl.textContent, "Current weather loaded.");
    assert.equal(harness.fields.locationName.textContent, "Portland, Oregon, United States");
  } finally {
    restoreGlobal("document", previousDocument, hadDocument);
    restoreGlobal("window", previousWindow, hadWindow);
    restoreGlobal("fetch", previousFetch, hadFetch);
  }
});

function createFrontendHarness() {
  const searchButton = createElement();
  const form = createElement({
    querySelector: (selector) => {
      assert.equal(selector, "button[type='submit']");
      return searchButton;
    }
  });
  const cityInput = createElement({ value: "" });
  const refreshButton = createElement({ disabled: true });
  const statusEl = createElement({ textContent: "Enter a city to load current weather.", className: "status is-idle" });
  const dashboard = createElement({ hidden: true });
  const unitInputs = [
    createElement({ value: "imperial", checked: false }),
    createElement({ value: "metric", checked: false })
  ];

  const fields = {
    visual: createElement(),
    locationName: createElement(),
    conditionText: createElement(),
    currentTemp: createElement(),
    feelsLike: createElement(),
    humidity: createElement(),
    wind: createElement(),
    precipitation: createElement(),
    cloudCover: createElement(),
    pressure: createElement(),
    gusts: createElement(),
    dailyHigh: createElement(),
    dailyLow: createElement(),
    rainChance: createElement(),
    sunrise: createElement(),
    sunset: createElement(),
    updatedAt: createElement()
  };

  const selectors = new Map([
    ["#weather-form", form],
    ["#city-input", cityInput],
    ["#refresh-button", refreshButton],
    ["#status", statusEl],
    ["#weather-dashboard", dashboard],
    ["#condition-visual", fields.visual],
    ["#location-name", fields.locationName],
    ["#condition-text", fields.conditionText],
    ["#current-temp", fields.currentTemp],
    ["#feels-like", fields.feelsLike],
    ["#humidity", fields.humidity],
    ["#wind", fields.wind],
    ["#precipitation", fields.precipitation],
    ["#cloud-cover", fields.cloudCover],
    ["#pressure", fields.pressure],
    ["#gusts", fields.gusts],
    ["#daily-high", fields.dailyHigh],
    ["#daily-low", fields.dailyLow],
    ["#rain-chance", fields.rainChance],
    ["#sunrise", fields.sunrise],
    ["#sunset", fields.sunset],
    ["#updated-at", fields.updatedAt]
  ]);

  return {
    form,
    cityInput,
    searchButton,
    refreshButton,
    statusEl,
    fields,
    document: {
      querySelector: (selector) => selectors.get(selector) ?? null,
      querySelectorAll: (selector) => (selector === "input[name='units']" ? unitInputs : [])
    },
    window: {
      clearTimeout: () => {},
      setTimeout: () => 1,
      localStorage: {
        getItem: () => null,
        setItem: () => {}
      }
    }
  };
}

function restoreGlobal(key, value, existed) {
  if (existed) {
    globalThis[key] = value;
    return;
  }

  delete globalThis[key];
}

function createElement(overrides = {}) {
  const listeners = new Map();

  return {
    attributes: new Map(),
    checked: false,
    className: "",
    disabled: false,
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
    },
    querySelector: () => null,
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    ...overrides
  };
}

function createPendingFetch() {
  const calls = [];

  const fetchMock = (url, options = {}) => {
    let rejectRequest;
    const request = {
      url: String(url),
      signal: options.signal,
      resolveJson(payload, status = 200) {
        this.resolve(new Response(JSON.stringify(payload), {
          status,
          headers: {
            "content-type": "application/json"
          }
        }));
      }
    };

    const promise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      rejectRequest = reject;
    });

    options.signal?.addEventListener("abort", () => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      rejectRequest(error);
    }, { once: true });

    calls.push(request);
    return promise;
  };

  fetchMock.calls = calls;
  return fetchMock;
}

async function settleAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createWeatherPayload(cityName) {
  return {
    city: {
      name: cityName,
      admin1: "Oregon",
      country: "United States"
    },
    units: {
      temperature: "\u00b0F",
      windSpeed: "mph",
      precipitation: "inch",
      pressure: "hPa",
      cloudCover: "%",
      humidity: "%"
    },
    current: {
      summary: "Clear sky",
      temperature: 70,
      apparentTemperature: 70,
      humidity: 50,
      windSpeed: 5,
      windDirection: 180,
      precipitation: 0,
      cloudCover: 10,
      pressure: 1015,
      windGusts: 8,
      weatherCode: 0,
      isDay: true
    },
    daily: {
      temperatureMax: 75,
      temperatureMin: 55,
      precipitationProbabilityMax: 5,
      precipitationProbabilityUnit: "%",
      sunrise: "2026-05-01T06:00",
      sunset: "2026-05-01T20:00"
    },
    source: {
      name: "Open-Meteo"
    },
    fetchedAt: "2026-05-01T12:00:00Z"
  };
}
