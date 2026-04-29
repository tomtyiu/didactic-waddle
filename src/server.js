import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchWeatherForCity, WeatherServiceError } from "./weatherService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX = 60;

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

export function createRequestHandler(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const rateLimiter = options.rateLimiter ?? createRateLimiter();

  return async function requestHandler(request, response) {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method !== "GET") {
        return sendJson(response, 405, {
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "Only GET requests are supported."
          }
        }, { allow: "GET" });
      }

      if (requestUrl.pathname === "/api/health") {
        return sendJson(response, 200, {
          status: "ok",
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString()
        });
      }

      if (requestUrl.pathname === "/api/weather") {
        const limit = rateLimiter(getClientKey(request));
        if (!limit.allowed) {
          return sendJson(response, 429, {
            error: {
              code: "RATE_LIMITED",
              message: "Too many weather requests. Try again shortly.",
              retryAfterSeconds: limit.retryAfterSeconds
            }
          }, { "retry-after": String(limit.retryAfterSeconds) });
        }

        const weather = await fetchWeatherForCity(requestUrl.searchParams.get("city"), {
          units: requestUrl.searchParams.get("units"),
          fetchImpl
        });
        return sendJson(response, 200, weather);
      }

      return serveStatic(requestUrl.pathname, response);
    } catch (error) {
      return handleError(error, response);
    }
  };
}

export function createRateLimiter(options = {}) {
  const windowMs = readPositiveInteger(options.windowMs ?? process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const maxRequests = readPositiveInteger(options.maxRequests ?? process.env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
  const buckets = new Map();

  return function checkRateLimit(key, now = Date.now()) {
    const bucketKey = key || "unknown";
    const existing = buckets.get(bucketKey);

    if (!existing || now >= existing.resetAt) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
    }

    if (existing.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
      };
    }

    existing.count += 1;
    return { allowed: true, remaining: maxRequests - existing.count, retryAfterSeconds: 0 };
  };
}

export function startServer(options = {}) {
  const port = readPositiveInteger(options.port ?? process.env.PORT, DEFAULT_PORT);
  const host = options.host ?? process.env.HOST ?? DEFAULT_HOST;
  const server = createServer(createRequestHandler(options));

  server.listen(port, host, () => {
    console.log(`Weather app listening on http://${host}:${port}`);
  });

  return server;
}

async function serveStatic(pathname, response) {
  const filePath = resolveStaticPath(pathname);

  if (!filePath) {
    return sendText(response, 404, "Not found");
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": MIME_TYPES.get(extname(filePath)) ?? "application/octet-stream",
      "cache-control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=300"
    });
    response.end(content);
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "EISDIR") {
      console.warn("static_asset_failed", { code: error?.code });
    }
    sendText(response, 404, "Not found");
  }
}

function resolveStaticPath(pathname) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes("\0")) {
    return null;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = normalize(join(PUBLIC_DIR, relativePath));
  const publicRoot = normalize(PUBLIC_DIR);

  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) {
    return null;
  }

  return filePath;
}

function handleError(error, response) {
  const statusCode = error instanceof WeatherServiceError ? error.statusCode : 500;
  const code = error instanceof WeatherServiceError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof WeatherServiceError ? error.message : "Something went wrong.";

  if (statusCode >= 500) {
    console.warn("weather_request_failed", { code, message });
  }

  return sendJson(response, statusCode, {
    error: {
      code,
      message
    }
  });
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(message);
}

function getClientKey(request) {
  return request.socket.remoteAddress ?? "unknown";
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
