import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT_DIR = process.cwd();
const WORKSPACE_ROOTS = ["packages", "apps", "workers"];
const CHANGESET_DIR = join(ROOT_DIR, ".changeset");
const NPM_CONFIG_TIMEOUT_MS = 5000;
const NPM_VIEW_TIMEOUT_MS = 15000;
const PUBLISHED_VERSION_CACHE = new Map();

function collectPackageJsonFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const packageFiles = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      packageFiles.push(...collectPackageJsonFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name === "package.json") {
      packageFiles.push(entryPath);
    }
  }
  return packageFiles;
}

export function collectWorkspacePackages() {
  return WORKSPACE_ROOTS.flatMap((workspaceRoot) => {
    const absoluteWorkspaceRoot = join(ROOT_DIR, workspaceRoot);
    if (!existsSync(absoluteWorkspaceRoot)) {
      return [];
    }
    return collectPackageJsonFiles(absoluteWorkspaceRoot).map((packageFile) => {
      const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
      const packageDir = packageFile.replace(/package\.json$/, "").replace(/\/$/, "");
      return {
        private: pkg.private !== false,
        packageFile: relative(ROOT_DIR, packageFile).replaceAll("\\", "/"),
        absolutePackageDir: packageDir,
        packageDir: relative(ROOT_DIR, packageDir).replaceAll("\\", "/"),
        pkg
      };
    });
  });
}

export function readPendingChangesetPackages() {
  if (!existsSync(CHANGESET_DIR)) {
    return new Set();
  }

  const entries = readdirSync(CHANGESET_DIR, { withFileTypes: true });
  const packages = new Set();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const content = readFileSync(join(CHANGESET_DIR, entry.name), "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      continue;
    }
    for (const line of match[1].split("\n")) {
      const trimmed = line.trim();
      const packageMatch = trimmed.match(/^["']?([^"']+)["']?\s*:\s*(major|minor|patch)\s*$/);
      if (packageMatch) {
        packages.add(packageMatch[1]);
      }
    }
  }
  return packages;
}

export function getPackageTagName(pkg) {
  return `${pkg.name}@${pkg.version}`;
}

export function getExpectedPublishGuardCommand(entry) {
  const relativeScriptPath = relative(
    entry.absolutePackageDir,
    join(ROOT_DIR, "scripts", "ensure-pnpm-publish.mjs")
  ).replaceAll("\\", "/");
  return `node ${relativeScriptPath}`;
}

export function hasGitTag(tagName) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/tags/${tagName}`], {
      cwd: ROOT_DIR,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

export function getExplicitReleaseBatchPackageNames(workspacePackages, pendingChangesetPackages) {
  const batchPackageNames = new Set(pendingChangesetPackages);
  for (const entry of workspacePackages) {
    if (entry.private) {
      continue;
    }
    if (!hasGitTag(getPackageTagName(entry.pkg))) {
      batchPackageNames.add(entry.pkg.name);
    }
  }
  return batchPackageNames;
}

export function resolveExplicitReleaseBatchPackages(
  workspacePackages,
  pendingChangesetPackages
) {
  const batchPackageNames = getExplicitReleaseBatchPackageNames(
    workspacePackages,
    pendingChangesetPackages
  );
  return workspacePackages.filter(
    (entry) => entry.private === false && batchPackageNames.has(entry.pkg.name)
  );
}

export function readNpmRegistry() {
  return execFileSync("npm", ["config", "get", "registry"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: NPM_CONFIG_TIMEOUT_MS
  }).trim();
}

function parseNpmViewJson(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function readPublishedExactPackageVersion(packageName, version) {
  const cacheKey = `${packageName}@${version}`;
  if (PUBLISHED_VERSION_CACHE.has(cacheKey)) {
    return PUBLISHED_VERSION_CACHE.get(cacheKey);
  }

  try {
    const output = execFileSync(
      "npm",
      ["view", `${packageName}@${version}`, "version", "--json"],
      {
        cwd: ROOT_DIR,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: NPM_VIEW_TIMEOUT_MS
      }
    );
    const parsed = parseNpmViewJson(output);
    const exactVersion = typeof parsed === "string" ? parsed : null;
    PUBLISHED_VERSION_CACHE.set(cacheKey, exactVersion);
    return exactVersion;
  } catch {
    PUBLISHED_VERSION_CACHE.set(cacheKey, null);
    return null;
  }
}

export function isPackageVersionPublished(entry) {
  return readPublishedExactPackageVersion(entry.pkg.name, entry.pkg.version) === entry.pkg.version;
}

export function isMeaningfulReleaseDrift(packageDir, changedFile) {
  const relativePath = relative(packageDir, changedFile).replaceAll("\\", "/");
  if (!relativePath || relativePath.startsWith("..")) {
    return false;
  }
  const fileName = basename(relativePath);
  if (fileName === "README.md" || fileName === "CHANGELOG.md") {
    return false;
  }
  if (/\.(test|spec)\.[^.]+$/.test(fileName)) {
    return false;
  }
  return true;
}

export function readMeaningfulReleaseDrift(entry) {
  const tagName = getPackageTagName(entry.pkg);
  if (!hasGitTag(tagName)) {
    return [];
  }

  return execFileSync(
    "git",
    ["diff", "--name-only", `${tagName}..HEAD`, "--", entry.packageDir],
    {
      cwd: ROOT_DIR,
      encoding: "utf8"
    }
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => isMeaningfulReleaseDrift(entry.absolutePackageDir, join(ROOT_DIR, file)));
}
