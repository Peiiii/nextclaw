import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INCLUDED_ROOTS = new Set(["packages", "apps", "workers", "scripts", "bridge"]);
const EXCLUDED_ROOT_PATHS = new Set(["apps/docs"]);
const IGNORED_DIRS = new Set([
  ".git",
  ".changeset",
  "node_modules",
  "dist",
  "coverage",
  "build",
  "ui-dist",
  ".turbo",
  "release",
  "out",
  ".next",
  ".wrangler",
  ".temp",
  ".vitepress",
  ".vite",
  "public",
  "vendor"
]);
const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
export const ENTRY_BASENAMES = new Set(["index", "main", "preload", "app"]);
const LAYER_CONFIGS = [
  { name: "types", rank: 0, segments: new Set(["types"]) },
  { name: "foundation", rank: 0, segments: new Set(["constants", "config", "configs", "schema", "schemas"]) },
  { name: "utility", rank: 0, segments: new Set(["lib", "utils", "shared"]) },
  { name: "hook", rank: 1, segments: new Set(["hooks"]) },
  { name: "store", rank: 1, segments: new Set(["store", "stores", "state"]) },
  { name: "transport", rank: 1, segments: new Set(["api", "transport", "client"]) },
  { name: "ui-component", rank: 2, segments: new Set(["ui"]) },
  { name: "component", rank: 2, segments: new Set(["components"]) },
  { name: "page", rank: 3, segments: new Set(["pages"]) },
  { name: "command", rank: 4, segments: new Set(["commands"]) },
  { name: "router", rank: 4, segments: new Set(["router", "routes"]) },
  { name: "controller", rank: 4, segments: new Set(["controller", "controllers"]) },
  { name: "service", rank: 4, segments: new Set(["service", "services"]) },
  { name: "provider", rank: 4, segments: new Set(["provider", "providers"]) },
  { name: "channel", rank: 4, segments: new Set(["channel", "channels"]) },
  { name: "runtime", rank: 4, segments: new Set(["runtime", "runtimes"]) }
];
const LAYER_BY_NAME = new Map(LAYER_CONFIGS.map((entry) => [entry.name, entry]));
export const STRICT_LOW_LAYERS = new Set(["types", "foundation", "utility", "ui-component", "component"]);
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]|import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

export function toPosix(input) {
  return input.split(path.sep).join(path.posix.sep);
}

export function readJson(filePath) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const normalizedText = sourceText
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(normalizedText);
}

function isCodeFile(fileName) {
  return CODE_EXTENSIONS.includes(path.extname(fileName));
}

function isTestFile(repoPath) {
  return /(?:^|\/)(?:__tests__|tests)\//.test(repoPath) || repoPath.includes(".test.") || repoPath.includes(".spec.");
}

function isDeclarationFile(repoPath) {
  return repoPath.endsWith(".d.ts");
}

export function isTestSupportFile(repoPath) {
  return (
    repoPath.includes(".test-helper") ||
    repoPath.includes(".test-helpers") ||
    repoPath.includes(".test-mock") ||
    repoPath.includes(".test-mocks") ||
    repoPath.includes("test-harness")
  );
}

function shouldSkipPath(repoPath) {
  if (EXCLUDED_ROOT_PATHS.has(repoPath)) {
    return true;
  }
  return repoPath.split("/").some((segment) => IGNORED_DIRS.has(segment));
}

function listWorkspaceDirs() {
  const rootPackage = readJson(path.resolve(ROOT, "package.json"));
  const patterns = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  const dirs = new Set();

  for (const pattern of patterns) {
    if (!pattern.endsWith("/*")) {
      continue;
    }
    const baseDir = path.resolve(ROOT, pattern.slice(0, -2));
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const workspaceDir = path.resolve(baseDir, entry.name);
      const repoPath = toPosix(path.relative(ROOT, workspaceDir));
      if (fs.existsSync(path.resolve(workspaceDir, "package.json")) && !shouldSkipPath(repoPath)) {
        dirs.add(workspaceDir);
      }
    }
  }

  return [...dirs].sort();
}

export function collectWorkspaceInfo() {
  const workspaces = [];
  const byName = new Map();

  for (const workspaceDir of listWorkspaceDirs()) {
    const workspacePath = toPosix(path.relative(ROOT, workspaceDir));
    const packageJson = readJson(path.resolve(workspaceDir, "package.json"));
    const tsconfigPath = path.resolve(workspaceDir, "tsconfig.json");
    const compilerOptions = fs.existsSync(tsconfigPath) ? readJson(tsconfigPath).compilerOptions ?? {} : {};
    const baseUrl = typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : ".";
    const paths = typeof compilerOptions.paths === "object" && compilerOptions.paths ? compilerOptions.paths : {};
    const info = {
      workspaceDir,
      workspacePath,
      packageName: typeof packageJson.name === "string" ? packageJson.name : workspacePath,
      packageJson,
      baseUrl: path.resolve(workspaceDir, baseUrl),
      paths
    };
    workspaces.push(info);
    byName.set(info.packageName, info);
  }

  return { workspaces, byName };
}

export function walkRepoFiles() {
  const repoPaths = [];
  const pending = [...INCLUDED_ROOTS].map((segment) => path.resolve(ROOT, segment));

  while (pending.length > 0) {
    const currentPath = pending.pop();
    if (!fs.existsSync(currentPath)) {
      continue;
    }

    const repoPath = toPosix(path.relative(ROOT, currentPath));
    if (repoPath && shouldSkipPath(repoPath)) {
      continue;
    }

    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
        pending.push(path.resolve(currentPath, entry.name));
      }
      continue;
    }

    if (stat.isFile() && isCodeFile(currentPath) && !isDeclarationFile(repoPath) && !isTestFile(repoPath)) {
      repoPaths.push(repoPath);
    }
  }

  return repoPaths.sort();
}

export function findWorkspaceForFile(repoPath, workspaces) {
  return (
    workspaces
      .filter((workspace) => repoPath === workspace.workspacePath || repoPath.startsWith(`${workspace.workspacePath}/`))
      .sort((left, right) => right.workspacePath.length - left.workspacePath.length)[0] ?? null
  );
}

function getPathAfterSourceRoot(repoPath, workspacePath) {
  if (repoPath.startsWith("bridge/src/")) {
    return repoPath.slice("bridge/src/".length);
  }
  if (!workspacePath) {
    return "";
  }

  const sourcePrefix = `${workspacePath}/src/`;
  if (repoPath.startsWith(sourcePrefix)) {
    return repoPath.slice(sourcePrefix.length);
  }

  return repoPath.startsWith(`${workspacePath}/`) ? repoPath.slice(`${workspacePath}/`.length) : repoPath;
}

export function inferLayer(repoPath, workspace) {
  if (repoPath.startsWith("scripts/")) {
    return { name: "script", rank: null };
  }

  const segments = getPathAfterSourceRoot(repoPath, workspace?.workspacePath ?? "").split("/").filter(Boolean);
  if (segments.length === 0) {
    return { name: "entry", rank: null };
  }
  if (segments[0] === "cli" && segments[1] === "commands") {
    return LAYER_BY_NAME.get("command");
  }

  for (const segment of segments) {
    for (const config of LAYER_CONFIGS) {
      if (config.segments.has(segment)) {
        return config;
      }
    }
  }

  const baseName = path.basename(repoPath, path.extname(repoPath));
  return LAYER_BY_NAME.get(baseName.split(".").at(-1)) ?? { name: "feature", rank: null };
}

export function resolveSourceCandidate(candidatePath, moduleMap) {
  const normalized = toPosix(path.normalize(candidatePath));
  const candidates = new Set([normalized]);

  if (/\.(?:js|mjs|cjs)$/.test(normalized)) {
    const noExt = normalized.replace(/\.(?:js|mjs|cjs)$/, "");
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.add(`${noExt}${extension}`);
    }
  }

  if (normalized.includes("/dist/")) {
    const sourcePath = normalized.replace("/dist/", "/src/").replace(/\.(?:js|mjs|cjs)$/, "");
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.add(`${sourcePath}${extension}`);
    }
  }

  const basePath = normalized.replace(/\.(?:ts|tsx|js|jsx|mjs|cjs)$/, "");
  for (const extension of SOURCE_EXTENSIONS) {
    candidates.add(`${basePath}${extension}`);
    candidates.add(`${basePath}/index${extension}`);
  }

  for (const entry of candidates) {
    if (moduleMap.has(entry)) {
      return entry;
    }
  }

  return null;
}

export function collectPackageEntrypoints(workspace, moduleMap) {
  const rawPaths = new Set();
  const pushValue = (value) => {
    if (typeof value === "string" && value.startsWith(".")) {
      rawPaths.add(value);
      return;
    }
    if (value && typeof value === "object") {
      for (const nestedValue of Object.values(value)) {
        pushValue(nestedValue);
      }
    }
  };

  pushValue(workspace.packageJson.main);
  pushValue(workspace.packageJson.module);
  pushValue(workspace.packageJson.bin);
  pushValue(workspace.packageJson.exports);
  pushValue(workspace.packageJson.openclaw?.extensions);

  const resolved = new Set();
  for (const rawPath of rawPaths) {
    const repoPath = resolveSourceCandidate(toPosix(path.relative(ROOT, path.resolve(workspace.workspaceDir, rawPath))), moduleMap);
    if (repoPath) {
      resolved.add(repoPath);
    }
  }

  for (const baseName of ENTRY_BASENAMES) {
    for (const extension of SOURCE_EXTENSIONS) {
      const repoPath = resolveSourceCandidate(`${workspace.workspacePath}/src/${baseName}${extension}`, moduleMap);
      if (repoPath) {
        resolved.add(repoPath);
      }
    }
  }

  return resolved;
}

function replaceStar(pattern, value) {
  return pattern.includes("*") ? pattern.replace(/\*/g, value) : pattern;
}

function matchPathPattern(pattern, specifier) {
  if (!pattern.includes("*")) {
    return pattern === specifier ? "" : null;
  }
  const [prefix, suffix] = pattern.split("*");
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
    return null;
  }
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

export function resolveImport(specifier, importer, workspace, moduleMap, packageByName) {
  if (!workspace) {
    return null;
  }

  const candidates = [];
  const importerDir = path.dirname(path.resolve(ROOT, importer.repoPath));
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    candidates.push(path.resolve(importerDir, specifier));
  }

  for (const [key, values] of Object.entries(workspace.paths)) {
    const wildcardValue = matchPathPattern(key, specifier);
    if (wildcardValue == null) {
      continue;
    }
    for (const value of Array.isArray(values) ? values : []) {
      candidates.push(path.resolve(workspace.baseUrl, replaceStar(value, wildcardValue)));
    }
  }

  const packageInfo = [...packageByName.entries()]
    .sort((left, right) => right[0].length - left[0].length)
    .find(([packageName]) => specifier === packageName || specifier.startsWith(`${packageName}/`));
  if (packageInfo) {
    const [packageName, targetWorkspace] = packageInfo;
    const subpath = specifier === packageName ? "" : specifier.slice(packageName.length + 1);
    candidates.push(path.resolve(targetWorkspace.workspaceDir, "src", subpath));
    candidates.push(path.resolve(targetWorkspace.workspaceDir, subpath));
  }

  if (!specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("#")) {
    candidates.push(path.resolve(workspace.baseUrl, specifier));
  }

  for (const candidate of candidates) {
    const repoPath = resolveSourceCandidate(toPosix(path.relative(ROOT, candidate)), moduleMap);
    if (repoPath) {
      return repoPath;
    }
  }

  return null;
}

export function collectImportSpecifiers(sourceText) {
  const specifiers = [];
  let match = IMPORT_PATTERN.exec(sourceText);
  while (match) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) {
      specifiers.push(specifier);
    }
    match = IMPORT_PATTERN.exec(sourceText);
  }
  IMPORT_PATTERN.lastIndex = 0;
  return specifiers;
}
