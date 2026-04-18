import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
export const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".py",
  ".sh"
]);
export const IGNORED_PARTS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vite",
  ".vitepress",
  "out",
  "tmp"
]);
export const FUNCTION_RULE_IDS = new Set([
  "max-lines-per-function",
  "max-statements",
  "max-depth",
  "sonarjs/cognitive-complexity"
]);
export const DISABLE_GUARD_RULE_IDS = new Set([...FUNCTION_RULE_IDS, "max-lines"]);
const DISABLE_COMMENT_PATTERN = /eslint-disable(?:-next-line|-line)?/;
const DIFF_HUNK_PATTERN = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
const ROLE_SUFFIXES = new Set([
  "controller",
  "manager",
  "store",
  "service",
  "repository",
  "adapter",
  "gateway",
  "middleware",
  "guard",
  "interceptor",
  "factory",
  "schema",
  "types",
  "constants",
  "utils",
  "mapper",
  "config",
  "cache"
]);
const CACHE_EXPECTATION_SIGNALS = [
  { label: "queryClient", pattern: /\bqueryClient\b/ },
  { label: "getQueryData", pattern: /\bgetQueryData\b/ },
  { label: "setQueryData", pattern: /\bsetQueryData\b/ },
  { label: "invalidateQueries", pattern: /\binvalidateQueries\b/ },
  { label: "cache", pattern: /\bcache(?:d)?\b/i },
  { label: "staleTime", pattern: /\bstaleTime\b/ },
  { label: "ttl", pattern: /\bttl\b/i },
  { label: "Map", pattern: /\b(?:Weak)?Map\b/ },
  { label: "memo", pattern: /\bmemo(?:ize)?\b/i }
];
const CACHE_MAPPER_SIGNALS = [
  { label: "apply*", pattern: /\bapply[A-Z][A-Za-z0-9]*\b/ },
  { label: "build*", pattern: /\bbuild[A-Z][A-Za-z0-9]*\b/ },
  { label: "normalize*", pattern: /\bnormalize[A-Z][A-Za-z0-9]*\b/ },
  { label: "map*", pattern: /\bmap[A-Z][A-Za-z0-9]*\b/ },
  { label: "transform*", pattern: /\btransform[A-Z][A-Za-z0-9]*\b/ },
  { label: "dedupe*", pattern: /\bdedupe[A-Z][A-Za-z0-9]*\b/ },
  { label: "ensure*", pattern: /\bensure[A-Z][A-Za-z0-9]*\b/ }
];

export function runGit(args, check = true) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8"
  });
  if (check && result.status !== 0) {
    throw new Error((result.stderr || "").trim() || "git command failed");
  }
  return result.stdout ?? "";
}

export function normalizePath(pathText) {
  const raw = `${pathText ?? ""}`.trim();
  if (!raw) {
    return raw;
  }
  return raw.split(path.sep).join(path.posix.sep);
}

export function inferPrimaryRole(pathText) {
  const normalized = normalizePath(pathText);
  const stem = path.posix.basename(normalized, path.posix.extname(normalized)).toLowerCase();
  const tokens = stem.split(/[.-]/g).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }
  const candidate = tokens[tokens.length - 1];
  return ROLE_SUFFIXES.has(candidate) ? candidate : null;
}

export function isCodePath(pathText) {
  const normalized = normalizePath(pathText);
  if (!normalized) {
    return false;
  }
  const parts = normalized.split("/");
  if (parts.some((part) => IGNORED_PARTS.has(part))) {
    return false;
  }
  return CODE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase());
}

export function isTestPath(pathText) {
  const normalized = normalizePath(pathText);
  if (!normalized) {
    return false;
  }
  const name = path.posix.basename(normalized).toLowerCase();
  const segments = normalized.split("/").map((segment) => segment.toLowerCase());
  return name.includes(".test.") || name.includes(".spec.") || segments.some((segment) => segment === "__tests__" || segment === "tests");
}

export function listCodeFilesUnder(pathText) {
  const absoluteRoot = path.resolve(ROOT, pathText);
  if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
    return [];
  }

  const files = [];
  for (const child of fs.readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })) {
    if (!child.isFile()) {
      continue;
    }
    const childAbsolutePath = path.join(child.parentPath, child.name);
    const childPath = normalizePath(path.relative(ROOT, childAbsolutePath));
    if (childPath && isCodePath(childPath)) {
      files.push(childPath);
    }
  }
  return files;
}

export function listChangedPaths() {
  const output = runGit(["status", "--porcelain"]);
  const paths = [];

  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    let payload = line.slice(3);
    if (payload.includes(" -> ")) {
      payload = payload.split(" -> ", 2)[1];
    }
    const pathText = normalizePath(payload);
    const absolutePath = path.resolve(ROOT, pathText);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
      paths.push(...listCodeFilesUnder(pathText));
      continue;
    }
    if (pathText && isCodePath(pathText)) {
      paths.push(pathText);
    }
  }

  return [...new Set(paths)];
}

export function readFileText(pathText) {
  return fs.readFileSync(path.resolve(ROOT, pathText), "utf8");
}

export function countLinesInText(text) {
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

export function getHeadContent(pathText) {
  const result = spawnSync("git", ["show", `HEAD:${pathText}`], {
    cwd: ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout ?? "";
}

export function chooseBudget(pathText) {
  const normalized = normalizePath(pathText);
  const segments = normalized.split("/").map((segment) => segment.toLowerCase());
  const name = path.posix.basename(normalized).toLowerCase();
  const stem = path.posix.basename(normalized, path.posix.extname(normalized)).toLowerCase();

  if (isTestPath(pathText)) {
    return { maxLines: 900, category: "test" };
  }
  if (new Set(["types", "schema", "schemas", "constants"]).has(stem) || [".types.ts", ".schema.ts", ".constants.ts", ".config.ts"].some((suffix) => name.endsWith(suffix))) {
    return { maxLines: 900, category: "types-or-config" };
  }
  if (segments.includes("pages") || name === "app.tsx" || name === "app.ts" || name.endsWith("page.tsx")) {
    return { maxLines: 650, category: "page-or-app" };
  }
  if (segments.includes("components") || ["form", "dialog", "panel", "modal"].some((token) => stem.includes(token))) {
    return { maxLines: 500, category: "ui-component" };
  }
  if (["service", "controller", "manager", "runtime", "loop", "router", "provider"].some((token) => stem.includes(token))) {
    return { maxLines: 600, category: "orchestrator" };
  }
  if (normalized.startsWith("scripts/") || segments.includes("scripts")) {
    return { maxLines: 500, category: "script" };
  }
  return { maxLines: 400, category: "default" };
}

export function suggestSeam(pathText, ruleId = null) {
  const normalized = normalizePath(pathText);
  const stem = path.posix.basename(normalized, path.posix.extname(normalized)).toLowerCase();
  if (ruleId === "max-statements") {
    return "extract branching workflows into helper functions with single-purpose steps";
  }
  if (ruleId === "max-depth") {
    return "flatten nested branching with guard clauses or delegated helpers";
  }
  if (ruleId === "sonarjs/cognitive-complexity") {
    return "split decision-heavy orchestration into named phases with narrower responsibilities";
  }
  if (["service", "runtime", "loop", "router", "controller"].some((token) => stem.includes(token))) {
    return "extract orchestration, IO, and state transitions into separate modules";
  }
  if (["form", "page", "app", "panel", "dialog"].some((token) => stem.includes(token))) {
    return "extract hooks, sections, and normalization helpers out of the UI shell";
  }
  if (stem.includes("test") || stem.includes("spec")) {
    return "split fixtures/builders from behavior-focused test cases";
  }
  return "split mixed responsibilities into smaller domain-focused modules";
}

export function suggestNamingSeam(pathText, role) {
  if (role === "cache") {
    return "rename toward a mapper/utils-style file, or move real cache coordination into a dedicated cache module";
  }
  return `rename the file so its suffix matches the dominant responsibility instead of '${role}'`;
}

function collectSignalLabels(content, signals) {
  return signals.filter((signal) => signal.pattern.test(content)).map((signal) => signal.label);
}

export function inspectNamingResponsibility(pathText, content) {
  const role = inferPrimaryRole(pathText);
  if (role !== "cache") {
    return [];
  }

  const cacheSignals = collectSignalLabels(content, CACHE_EXPECTATION_SIGNALS);
  const mapperSignals = collectSignalLabels(content, CACHE_MAPPER_SIGNALS);

  if (cacheSignals.length > 0 || mapperSignals.length === 0) {
    return [];
  }

  return [{
    role,
    ruleId: "filename-role-alignment",
    matchedSignals: mapperSignals,
    message: "filename suggests a cache module, but the implementation looks like pure mapping/update logic and lacks cache coordination signals",
    suggestedSeam: suggestNamingSeam(pathText, role)
  }];
}

export function parseChangedPatch(pathText) {
  const output = runGit(["diff", "--unified=0", "--", pathText], false);
  const changedLines = new Set();
  const addedLines = [];
  let isNewFile = false;

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("new file mode ")) {
      isNewFile = true;
      continue;
    }
    if (line.startsWith("@@")) {
      const match = line.match(DIFF_HUNK_PATTERN);
      if (!match) {
        continue;
      }
      const start = Number(match[1]);
      const count = Number(match[2] || "1");
      if (count <= 0) {
        continue;
      }
      for (let current = start; current < start + count; current += 1) {
        changedLines.add(current);
      }
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      addedLines.push(line.slice(1));
    }
  }

  return { changedLines, addedLines, isNewFile };
}

export function rangeIntersectsChanged(line, endLine, changedLines) {
  if (!changedLines.size) {
    return false;
  }
  const actualEnd = Math.max(endLine, line);
  for (let current = Math.max(1, line); current <= actualEnd; current += 1) {
    if (changedLines.has(current)) {
      return true;
    }
  }
  return false;
}

export function collectDisableCommentFindings(params) {
  const findings = [];
  for (const rawLine of params.addedLines) {
    if (!DISABLE_COMMENT_PATTERN.test(rawLine)) {
      continue;
    }
    const matchedRules = [...DISABLE_GUARD_RULE_IDS].filter((ruleId) => rawLine.includes(ruleId)).sort();
    if (matchedRules.length === 0) {
      continue;
    }
    findings.push({
      level: "error",
      source: "disable-comment",
      path: params.pathText,
      category: params.category,
      budget: null,
      current_lines: params.currentLines,
      previous_lines: params.previousLines,
      delta_lines: params.deltaLines,
      message: `new eslint disable comment for maintainability rule(s): ${matchedRules.join(", ")}`,
      suggested_seam: suggestSeam(params.pathText),
      rule_id: matchedRules.join(", "),
      symbol_name: null,
      line: null,
      end_line: null,
      metric_value: null,
      previous_metric_value: null
    });
  }
  return findings;
}

export function safeExecFileSync(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options
  });
}
