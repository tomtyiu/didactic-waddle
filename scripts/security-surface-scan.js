import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const EXCLUDED_DIRS = new Set([".git", "node_modules", "coverage", "dist", "build"]);
const SCANNED_EXTENSIONS = new Set([".js", ".html", ".json"]);

const blockingRules = [
  {
    id: "dynamic-code-execution",
    pattern: /\b(?:eval|Function)\s*\(/g,
    message: "Dynamic code execution requires explicit review."
  },
  {
    id: "document-write",
    pattern: /\bdocument\.write\s*\(/g,
    message: "document.write can introduce injection and rendering risks."
  },
  {
    id: "external-script",
    pattern: /<script\b[^>]*\bsrc=["']https?:\/\//gi,
    message: "External browser scripts add a third-party supply-chain boundary."
  },
  {
    id: "hardcoded-secret",
    pattern: /\b(?:api[_-]?key|secret|password|token)\b\s*[:=]\s*["'][^"']{12,}["']/gi,
    message: "Potential hardcoded secret-like value."
  }
];

const reviewRules = [
  {
    id: "html-injection-sink",
    pattern: /\.innerHTML\s*=/g,
    message: "innerHTML should stay limited to trusted internal templates."
  },
  {
    id: "browser-storage",
    pattern: /\blocalStorage\b|\bsessionStorage\b/g,
    message: "Browser storage should not hold secrets or sensitive user data."
  },
  {
    id: "environment-config",
    pattern: /\bprocess\.env\./g,
    message: "Environment-backed config should avoid secret logging and unsafe defaults."
  },
  {
    id: "command-execution",
    pattern: /\bchild_process\b|\bexec(?:File|FileSync|Sync)?\s*\(/g,
    message: "Command execution paths should stay bounded to trusted maintenance commands."
  }
];

const findings = [];
const packageJson = readJson("package.json");

scanDependencySurface(packageJson);

for (const filePath of listScannableFiles(ROOT)) {
  if (relative(ROOT, filePath).split(sep).join("/") === "scripts/security-surface-scan.js") {
    continue;
  }

  const text = readFileSync(filePath, "utf8");
  const relativePath = relative(ROOT, filePath).split(sep).join("/");
  scanRules(relativePath, text, blockingRules, "blocker");
  if (!relativePath.startsWith("test/")) {
    scanRules(relativePath, text, reviewRules, "review");
  }
}

printReport();

const blockerCount = findings.filter((finding) => finding.severity === "blocker").length;
const reviewCount = findings.filter((finding) => finding.severity === "review").length;

if (blockerCount > 0 || (STRICT && reviewCount > 0)) {
  process.exitCode = 1;
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
  } catch (error) {
    findings.push({
      severity: "blocker",
      rule: "json-parse",
      file: relativePath,
      line: 1,
      message: `Unable to parse ${relativePath}: ${error.message}`
    });
    return {};
  }
}

function scanDependencySurface(manifest) {
  for (const key of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const entries = Object.entries(manifest[key] ?? {});
    if (entries.length === 0) {
      continue;
    }

    findings.push({
      severity: "review",
      rule: "dependency-surface",
      file: "package.json",
      line: 1,
      message: `${key} contains ${entries.length} package(s); review supply-chain need and lockfile state.`
    });
  }
}

function listScannableFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        files.push(...listScannableFiles(join(directory, entry.name)));
      }
      continue;
    }

    const filePath = join(directory, entry.name);
    if (entry.isFile() && SCANNED_EXTENSIONS.has(extname(filePath))) {
      files.push(filePath);
    }
  }

  return files;
}

function scanRules(file, text, rules, severity) {
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      findings.push({
        severity,
        rule: rule.id,
        file,
        line: lineNumberForOffset(text, match.index ?? 0),
        message: rule.message
      });
    }
  }
}

function lineNumberForOffset(text, offset) {
  let line = 1;

  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
    }
  }

  return line;
}

function printReport() {
  console.log("Security surface scan");
  console.log(`Root: ${ROOT}`);

  if (findings.length === 0) {
    console.log("OK: no security-surface findings.");
    return;
  }

  for (const finding of findings) {
    const prefix = finding.severity === "blocker" ? "BLOCKER" : "REVIEW";
    console.log(`${prefix}: ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
  }

  const blockerCount = findings.filter((finding) => finding.severity === "blocker").length;
  const reviewCount = findings.filter((finding) => finding.severity === "review").length;
  console.log(`Summary: ${blockerCount} blocker(s), ${reviewCount} review item(s).`);

  if (STRICT && reviewCount > 0) {
    console.log("Strict mode treats review items as failures.");
  }
}
