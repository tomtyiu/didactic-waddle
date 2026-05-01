import { execFileSync } from "node:child_process";

const STRICT = process.argv.includes("--strict");
const safeDirectoryCandidates = unique([
  process.env.INIT_CWD,
  process.cwd()
].filter(Boolean).map(normalizeForGit));
const warnings = [];
let gitExecutionError = "";

const root = git(["rev-parse", "--show-toplevel"], { fallback: process.cwd() });
const currentBranch = git(["branch", "--show-current"], { fallback: "detached" });
const head = git(["rev-parse", "--short", "HEAD"], { fallback: "unknown" });
const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { fallback: "" });
const status = git(["status", "--short"], { fallback: "" });
const untracked = git(["ls-files", "--others", "--exclude-standard"], { fallback: "" });
const localMain = git(["rev-parse", "--verify", "--quiet", "main"], { fallback: "" });
const originMain = git(["rev-parse", "--verify", "--quiet", "origin/main"], { fallback: "" });

console.log("Branch hygiene report");
console.log(`Root: ${root}`);
console.log(`Branch: ${currentBranch}`);
console.log(`HEAD: ${head}`);
console.log(`Upstream: ${upstream || "none"}`);

if (!upstream) {
  warn("current branch has no upstream; push with --set-upstream before opening a PR");
} else {
  const [behind, ahead] = git(["rev-list", "--left-right", "--count", `${upstream}...HEAD`], { fallback: "0\t0" })
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10));
  console.log(`Ahead/behind upstream: ahead ${Number.isFinite(ahead) ? ahead : 0}, behind ${Number.isFinite(behind) ? behind : 0}`);

  if (Number.isFinite(behind) && behind > 0) {
    warn(`current branch is behind ${upstream} by ${behind} commit(s)`);
  }
}

if (currentBranch === "main") {
  warn("working directly on main increases accidental commit risk; use a focused branch for maintenance work");
}

if (localMain && originMain) {
  const [mainBehind, mainAhead] = git(["rev-list", "--left-right", "--count", "origin/main...main"], { fallback: "0\t0" })
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10));
  console.log(`Local main vs origin/main: ahead ${Number.isFinite(mainAhead) ? mainAhead : 0}, behind ${Number.isFinite(mainBehind) ? mainBehind : 0}`);

  if (Number.isFinite(mainBehind) && mainBehind > 0) {
    warn(`local main is behind origin/main by ${mainBehind} commit(s)`);
  }

  if (currentBranch !== "main" && !status.trim() && isAncestor("HEAD", "origin/main")) {
    warn("current branch tip is already contained in origin/main; create new work from origin/main before editing");
  }
}

if (status.trim()) {
  console.log("Working tree changes:");
  console.log(indent(status.trim()));
  warn("working tree is not clean; keep unrelated files out of commits");
} else {
  console.log("Working tree changes: none");
}

if (untracked.trim()) {
  console.log("Untracked files:");
  console.log(indent(untracked.trim()));
}

if (gitExecutionError) {
  warn(`git command execution failed; branch hygiene could not be fully inspected (${gitExecutionError})`);
}

if (warnings.length === 0) {
  console.log("OK: branch hygiene checks passed.");
} else {
  console.log(`Warnings: ${warnings.length}`);
  for (const warning of warnings) {
    console.log(`WARN: ${warning}`);
  }
}

if (gitExecutionError || (STRICT && warnings.length > 0)) {
  process.exitCode = 1;
}

function warn(message) {
  warnings.push(message);
}

function git(args, options = {}) {
  for (let index = 0; index < safeDirectoryCandidates.length; index += 1) {
    const safeDirectory = safeDirectoryCandidates[index];

    try {
      return execFileSync("git", ["-c", `safe.directory=${safeDirectory}`, ...args], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }).trim();
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "ENOENT") {
        gitExecutionError ||= `${error.code}: ${error.message}`;
      }

      const hintedDirectory = parseSafeDirectoryHint(error);
      if (hintedDirectory && !safeDirectoryCandidates.includes(hintedDirectory)) {
        safeDirectoryCandidates.unshift(hintedDirectory);
        index = -1;
      }
    }
  }

  return options.fallback ?? "";
}

function isAncestor(ancestor, descendant) {
  for (const safeDirectory of safeDirectoryCandidates) {
    try {
      execFileSync("git", ["-c", `safe.directory=${safeDirectory}`, "merge-base", "--is-ancestor", ancestor, descendant], {
        cwd: process.cwd(),
        stdio: "ignore"
      });
      return true;
    } catch {
      // A non-zero merge-base result simply means the relationship is false.
    }
  }

  return false;
}

function indent(text) {
  return text
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}

function normalizeForGit(value) {
  return value.split("\\").join("/");
}

function parseSafeDirectoryHint(error) {
  const stderr = String(error?.stderr ?? "");
  const match = stderr.match(/safe\.directory\s+([^\r\n]+)/);
  return match ? normalizeForGit(match[1].trim()) : "";
}

function unique(values) {
  return [...new Set(values)];
}
