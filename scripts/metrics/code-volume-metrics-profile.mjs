import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

export const DEFAULT_SCOPE_PROFILE = "source";
export const SUPPORTED_SCOPE_PROFILES = new Set(["source", "repo-volume"]);

const SOURCE_INCLUDE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const REPO_VOLUME_INCLUDE_EXTENSIONS = [...SOURCE_INCLUDE_EXTENSIONS, ".sh", ".yml", ".yaml"];
const EXCLUDED_WORKSPACE_ROOTS = new Set(["apps/docs"]);
const COMMON_EXCLUDE_DIRS = [
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
  ".temp"
];
const REPO_VOLUME_EXTRA_INCLUDE_PATHS = ["bridge", "scripts"];
const DEFAULT_BENCHMARK_INCLUDE_PATHS = ["src", "extensions"];
const SOURCE_ROOT_DIR_CANDIDATES = ["src", "bridge/src", ".vitepress"];
const SOURCE_ROOT_FILE_CANDIDATES = ["index.ts", "index.tsx", "index.js", "index.jsx", "index.mjs", "index.cjs"];

const readWorkspacePatterns = (repoRoot) => {
  const packageJsonPath = resolve(repoRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (Array.isArray(packageJson.workspaces)) {
      return packageJson.workspaces.filter((item) => typeof item === "string");
    }
    if (Array.isArray(packageJson.workspaces?.packages)) {
      return packageJson.workspaces.packages.filter((item) => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
};

const expandWorkspacePattern = (repoRoot, pattern) => {
  const normalizedPattern = pattern.replace(/\/+$/, "");
  if (!normalizedPattern.includes("*")) {
    const absolutePath = resolve(repoRoot, normalizedPattern);
    return existsSync(absolutePath) && statSync(absolutePath).isDirectory() ? [absolutePath] : [];
  }

  if (!normalizedPattern.endsWith("/*")) {
    return [];
  }

  const basePath = resolve(repoRoot, normalizedPattern.slice(0, -2));
  if (!existsSync(basePath) || !statSync(basePath).isDirectory()) {
    return [];
  }

  return readdirSync(basePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(basePath, entry.name));
};

const listWorkspaceRoots = (repoRoot) => {
  const roots = new Set();
  for (const pattern of readWorkspacePatterns(repoRoot)) {
    for (const absolutePath of expandWorkspacePattern(repoRoot, pattern)) {
      const packageJsonPath = resolve(absolutePath, "package.json");
      if (existsSync(packageJsonPath) && statSync(packageJsonPath).isFile()) {
        const relativePath = relative(repoRoot, absolutePath).split("\\").join("/");
        if (!EXCLUDED_WORKSPACE_ROOTS.has(relativePath)) {
          roots.add(absolutePath);
        }
      }
    }
  }
  return [...roots].sort();
};

const collectSourceIncludePaths = (repoRoot) => {
  const includePaths = new Set();

  for (const workspaceRoot of listWorkspaceRoots(repoRoot)) {
    for (const candidateDir of SOURCE_ROOT_DIR_CANDIDATES) {
      const absolutePath = resolve(workspaceRoot, candidateDir);
      if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
        includePaths.add(relative(repoRoot, absolutePath));
      }
    }

    for (const candidateFile of SOURCE_ROOT_FILE_CANDIDATES) {
      const absolutePath = resolve(workspaceRoot, candidateFile);
      if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
        includePaths.add(relative(repoRoot, absolutePath));
      }
    }
  }

  const rootBridgeSourcePath = resolve(repoRoot, "bridge", "src");
  if (existsSync(rootBridgeSourcePath) && statSync(rootBridgeSourcePath).isDirectory()) {
    includePaths.add(relative(repoRoot, rootBridgeSourcePath));
  }

  return [...includePaths].sort();
};

export const createBaseScanConfig = ({ repoRoot, scopeProfile }) => {
  if (scopeProfile === "repo-volume") {
    return {
      title: "Repo Code Volume",
      includePaths: [
        ...listWorkspaceRoots(repoRoot).map((workspaceRoot) => relative(repoRoot, workspaceRoot)),
        ...REPO_VOLUME_EXTRA_INCLUDE_PATHS
      ]
        .filter((value, index, array) => array.indexOf(value) === index),
      includeExtensions: REPO_VOLUME_INCLUDE_EXTENSIONS,
      excludeDirs: COMMON_EXCLUDE_DIRS
    };
  }

  return {
    title: "Source LOC",
    includePaths: collectSourceIncludePaths(repoRoot),
    includeExtensions: SOURCE_INCLUDE_EXTENSIONS,
    excludeDirs: COMMON_EXCLUDE_DIRS
  };
};

export const createBenchmarkScanConfig = ({ benchmarkIncludePaths }) => ({
  includePaths: benchmarkIncludePaths.length > 0 ? benchmarkIncludePaths : DEFAULT_BENCHMARK_INCLUDE_PATHS,
  includeExtensions: SOURCE_INCLUDE_EXTENSIONS,
  excludeDirs: COMMON_EXCLUDE_DIRS
});
