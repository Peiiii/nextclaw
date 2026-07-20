import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { DEFAULT_SKILLS_DIR } from "@nextclaw/core";
import { SkillManager } from "@nextclaw/kernel";
import {
  fetchMarketplaceSkillFilesFromSources,
  fetchMarketplaceSkillItemFromSources,
  resolveMarketplaceReadApiBases,
  type MarketplaceSkillFileManifestEntry,
  writeMarketplaceSkillFiles
} from "@nextclaw-service/utils/marketplace/marketplace-client.utils.js";
import {
  buildMarketplaceSkillInstallState,
  hasLocalMarketplaceSkillDrift,
  isLocalMarketplaceInstallStateFile,
  readMarketplaceSkillInstallState,
  resolveMarketplaceSkillUpdateStatus,
  type MarketplaceSkillUpdateStatus,
  writeMarketplaceSkillInstallState
} from "@nextclaw-service/stores/marketplace-install-state.store.js";
import { validateSkillSelector } from "@nextclaw-service/utils/marketplace/marketplace-identity.utils.js";

type MarketplaceSkillInstallKind = "builtin" | "marketplace";

export type MarketplaceSkillInstallOptions = {
  slug: string;
  workdir: string;
  dir?: string;
  force?: boolean;
  apiBaseUrl?: string;
};

export async function installMarketplaceSkill(options: MarketplaceSkillInstallOptions): Promise<{
  slug: string;
  destinationDir: string;
  alreadyInstalled?: boolean;
  source: MarketplaceSkillInstallKind;
}> {
  const { slug, workdir: rawWorkdir, dir, force, apiBaseUrl } = options;
  const selector = validateSkillSelector(slug.trim(), "slug");
  const workdir = resolve(rawWorkdir);
  if (!existsSync(workdir)) {
    throw new Error(`Workdir does not exist: ${workdir}`);
  }

  const apiBases = resolveMarketplaceReadApiBases(apiBaseUrl);
  const itemResult = await fetchMarketplaceSkillItemFromSources(apiBases, selector);
  const item = itemResult.data;
  const installSlug = item.slug;
  const resolvedSlug = item.packageName || item.slug;
  const destinationDir = resolveMarketplaceSkillDestinationDir({
    workdir,
    slug: installSlug,
    dir,
  });

  if (item.install.kind === "builtin") {
    const builtinResult = resolveBuiltinMarketplaceInstallResult({
      workdir,
      slug: installSlug,
    });
    builtinResult.slug = resolvedSlug;
    return builtinResult;
  }

  const filesResult = await fetchMarketplaceSkillFilesFromSources(apiBases, selector);
  const filesPayload = filesResult.data;
  const existingInstall = prepareMarketplaceSkillDestinationDir({
    destinationDir,
    files: filesPayload.files,
    force,
    slug: installSlug,
  });
  if (existingInstall) {
    existingInstall.slug = resolvedSlug;
    return existingInstall;
  }
  await materializeMarketplaceSkill({
    destinationDir,
    files: filesPayload.files,
    apiBases: prioritizeMarketplaceApiBase(filesResult.apiBase, apiBases),
    item,
    stateApiBase: filesResult.apiBase,
    slug: selector,
  });
  return buildMarketplaceInstallResult(resolvedSlug, destinationDir);
}

export async function updateInstalledMarketplaceSkill(options: MarketplaceSkillInstallOptions): Promise<{
  slug: string;
  destinationDir: string;
  updated: boolean;
  source: MarketplaceSkillInstallKind;
  status: MarketplaceSkillUpdateStatus;
}> {
  const { slug, workdir: rawWorkdir, dir, force, apiBaseUrl } = options;
  const selector = validateSkillSelector(slug.trim(), "slug");
  const workdir = resolve(rawWorkdir);
  if (!existsSync(workdir)) {
    throw new Error(`Workdir does not exist: ${workdir}`);
  }

  const apiBases = resolveMarketplaceReadApiBases(apiBaseUrl);
  const itemResult = await fetchMarketplaceSkillItemFromSources(apiBases, selector);
  const item = itemResult.data;
  const destinationDir = resolveMarketplaceSkillDestinationDir({
    workdir,
    slug: item.slug,
    dir,
  });

  if (item.install.kind === "builtin") {
    return {
      slug: item.packageName || item.slug,
      destinationDir: resolveBuiltinSkillDir(workdir, item.slug),
      updated: false,
      source: "builtin",
      status: "up-to-date",
    };
  }

  if (!existsSync(destinationDir)) {
    throw new Error(`Marketplace skill is not installed: ${item.slug}`);
  }

  const currentState = readMarketplaceSkillInstallState(destinationDir);
  if (!currentState && !force) {
    throw new Error(`Missing marketplace install state for ${item.slug}; use --force to replace this skill from marketplace.`);
  }

  if (!force && currentState && hasLocalMarketplaceSkillDrift(destinationDir, currentState)) {
    throw new Error(`Local skill files changed since install: ${item.slug}; use --force to overwrite local changes.`);
  }

  const status = resolveMarketplaceSkillUpdateStatus(currentState, item.updatedAt);
  if (!force && status === "up-to-date") {
    return {
      slug: item.packageName || item.slug,
      destinationDir,
      updated: false,
      source: "marketplace",
      status,
    };
  }

  const filesResult = await fetchMarketplaceSkillFilesFromSources(apiBases, selector);
  const filesPayload = filesResult.data;
  await materializeMarketplaceSkill({
    destinationDir,
    files: filesPayload.files,
    apiBases: prioritizeMarketplaceApiBase(filesResult.apiBase, apiBases),
    item,
    stateApiBase: filesResult.apiBase,
    slug: selector,
  });

  return {
    slug: item.packageName || item.slug,
    destinationDir,
    updated: true,
    source: "marketplace",
    status: "up-to-date",
  };
}

function resolveMarketplaceSkillDestinationDir(params: {
  workdir: string;
  slug: string;
  dir?: string;
}): string {
  const { workdir, slug, dir } = params;
  const dirName = dir?.trim() || DEFAULT_SKILLS_DIR;
  return isAbsolute(dirName)
    ? resolve(dirName, slug)
    : resolve(workdir, dirName, slug);
}

function resolveBuiltinMarketplaceInstallResult(params: {
  workdir: string;
  slug: string;
}): {
  slug: string;
  destinationDir: string;
  alreadyInstalled: true;
  source: "builtin";
} {
  return {
    slug: params.slug,
    destinationDir: resolveBuiltinSkillDir(params.workdir, params.slug),
    alreadyInstalled: true,
    source: "builtin",
  };
}

function prepareMarketplaceSkillDestinationDir(params: {
  destinationDir: string;
  files: MarketplaceSkillFileManifestEntry[];
  force?: boolean;
  slug: string;
}): {
  slug: string;
  destinationDir: string;
  alreadyInstalled: true;
  source: "marketplace";
} | null {
  const { destinationDir, files, force, slug } = params;
  if (!force && existsSync(destinationDir)) {
    const existingDirState = inspectMarketplaceSkillDirectory(destinationDir, files);
    if (existingDirState === "installed") {
      return {
        slug,
        destinationDir,
        alreadyInstalled: true,
        source: "marketplace",
      };
    }
    if (existingDirState !== "recoverable") {
      throw new Error(`Skill directory already exists: ${destinationDir} (use --force)`);
    }
  }
  return null;
}

async function materializeMarketplaceSkill(params: {
  destinationDir: string;
  files: MarketplaceSkillFileManifestEntry[];
  apiBases: readonly string[];
  item: Parameters<typeof buildMarketplaceSkillInstallState>[0]["item"];
  stateApiBase: string;
  slug: string;
}): Promise<void> {
  const { apiBases, destinationDir, files, item, slug, stateApiBase } = params;
  const parentDir = dirname(destinationDir);
  mkdirSync(parentDir, { recursive: true });
  const stagingDir = mkdtempSync(join(parentDir, `.${basename(destinationDir)}-install-`));
  let previousDir: string | null = null;

  try {
    const writtenFiles = await writeMarketplaceSkillFiles({
      destinationDir: stagingDir,
      files,
      apiBases,
      slug,
    });
    ensureInstalledMarketplaceSkill(stagingDir, item.slug);
    writeMarketplaceSkillInstallState({
      destinationDir: stagingDir,
      state: buildMarketplaceSkillInstallState({
        item,
        apiBase: stateApiBase,
        files: writtenFiles,
      }),
    });

    if (existsSync(destinationDir)) {
      previousDir = `${stagingDir}-previous`;
      renameSync(destinationDir, previousDir);
    }
    renameSync(stagingDir, destinationDir);
    if (previousDir) {
      rmSync(previousDir, { recursive: true, force: true });
    }
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    if (previousDir && existsSync(previousDir)) {
      rmSync(destinationDir, { recursive: true, force: true });
      renameSync(previousDir, destinationDir);
    }
    throw error;
  }
}

function prioritizeMarketplaceApiBase(primary: string, candidates: readonly string[]): readonly string[] {
  return [primary, ...candidates.filter((candidate) => candidate !== primary)];
}

function ensureInstalledMarketplaceSkill(destinationDir: string, slug: string): void {
  if (!existsSync(join(destinationDir, "SKILL.md"))) {
    throw new Error(`Marketplace skill ${slug} does not include SKILL.md`);
  }
}

function buildMarketplaceInstallResult(slug: string, destinationDir: string): {
  slug: string;
  destinationDir: string;
  source: "marketplace";
} {
  return {
    slug,
    destinationDir,
    source: "marketplace",
  };
}

function inspectMarketplaceSkillDirectory(
  destinationDir: string,
  files: MarketplaceSkillFileManifestEntry[]
): "installed" | "recoverable" | "conflict" {
  const discoveredFiles = collectRelativeFiles(destinationDir);
  if (discoveredFiles === null) {
    return "conflict";
  }

  const relevantFiles = discoveredFiles.filter((file) => !isIgnorableMarketplaceResidue(file));
  if (relevantFiles.length === 0) {
    return "recoverable";
  }

  const manifestPaths = new Set(files.map((file) => normalizeMarketplaceRelativePath(file.path)));
  if (!relevantFiles.every((file) => manifestPaths.has(normalizeMarketplaceRelativePath(file)))) {
    return "conflict";
  }
  const installedPaths = new Set(relevantFiles.map(normalizeMarketplaceRelativePath));
  return manifestPaths.size > 0 && [...manifestPaths].every((file) => installedPaths.has(file))
    ? "installed"
    : "recoverable";
}

function collectRelativeFiles(rootDir: string): string[] | null {
  const output: string[] = [];
  const walk = (dir: string): boolean => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!walk(absolute)) {
          return false;
        }
        continue;
      }
      if (!entry.isFile()) {
        return false;
      }
      const relativePath = relative(rootDir, absolute);
      output.push(normalizeMarketplaceRelativePath(relativePath));
    }
    return true;
  };

  return walk(rootDir) ? output : null;
}

function normalizeMarketplaceRelativePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function isIgnorableMarketplaceResidue(path: string): boolean {
  return path === ".DS_Store" || isLocalMarketplaceInstallStateFile(path);
}

function resolveBuiltinSkillDir(workdir: string, skillName: string): string {
  const skillDir = new SkillManager({ workspace: workdir }).resolveBuiltinSkillDir(skillName);
  if (!skillDir) {
    throw new Error(`Built-in skill not found in local installation: ${skillName}`);
  }
  return skillDir;
}
