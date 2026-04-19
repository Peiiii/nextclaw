import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { SkillsLoader } from "@nextclaw/core";
import {
  buildLocalizedTextMap,
  parseSkillFrontmatter,
  readMarketplaceMetadataFile,
  type LocalizedTextMap
} from "./marketplace.metadata.js";
import { PlatformAuthCommands } from "../platform-auth.js";
import {
  fetchMarketplaceSkillFileBlob,
  fetchMarketplaceSkillFiles,
  fetchMarketplaceSkillItem,
  type MarketplaceSkillFileManifestEntry,
  readMarketplaceEnvelope,
  resolveMarketplaceAdminToken,
  resolveMarketplaceApiBase
} from "./marketplace-client.js";
import {
  normalizeTags,
  resolvePublishPackageName,
  validateSkillSelector,
  validateSkillSlug
} from "./marketplace-identity.js";
import { runWithMarketplaceNetworkRetry } from "./marketplace-network-retry.js";

type MarketplaceSkillInstallKind = "builtin" | "marketplace";

export type MarketplaceSkillInstallOptions = {
  slug: string;
  workdir: string;
  dir?: string;
  force?: boolean;
  apiBaseUrl?: string;
};

export type MarketplaceSkillPublishOptions = {
  skillDir: string;
  metaFile?: string;
  slug?: string;
  packageName?: string;
  scope?: string;
  name?: string;
  summary?: string;
  summaryI18n?: LocalizedTextMap;
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  author?: string;
  tags?: string[];
  sourceRepo?: string;
  homepage?: string;
  publishedAt?: string;
  updatedAt?: string;
  apiBaseUrl?: string;
  token?: string;
  requireExisting?: boolean;
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

  const apiBase = resolveMarketplaceApiBase(apiBaseUrl);
  const item = await fetchMarketplaceSkillItem(apiBase, selector);
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

  const filesPayload = await fetchMarketplaceSkillFiles(apiBase, selector);
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
  await writeMarketplaceSkillFiles({
    destinationDir,
    files: filesPayload.files,
    apiBase,
    slug: selector,
  });
  ensureInstalledMarketplaceSkill(destinationDir, installSlug);
  return buildMarketplaceInstallResult(resolvedSlug, destinationDir);
}

function resolveMarketplaceSkillDestinationDir(params: {
  workdir: string;
  slug: string;
  dir?: string;
}): string {
  const { workdir, slug, dir } = params;
  const dirName = dir?.trim() || "skills";
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
    rmSync(destinationDir, { recursive: true, force: true });
  }

  if (force && existsSync(destinationDir)) {
    rmSync(destinationDir, { recursive: true, force: true });
  }

  mkdirSync(destinationDir, { recursive: true });
  return null;
}

async function writeMarketplaceSkillFiles(params: {
  destinationDir: string;
  files: MarketplaceSkillFileManifestEntry[];
  apiBase: string;
  slug: string;
}): Promise<void> {
  const { destinationDir, files, apiBase, slug } = params;
  for (const file of files) {
    const targetPath = resolve(destinationDir, ...file.path.split("/"));
    const rel = relative(destinationDir, targetPath);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Invalid marketplace file path: ${file.path}`);
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    const bytes = file.contentBase64
      ? decodeMarketplaceFileContent(file.path, file.contentBase64)
      : await fetchMarketplaceSkillFileBlob(apiBase, slug, file);
    writeFileSync(targetPath, bytes);
  }
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
  if (existsSync(join(destinationDir, "SKILL.md"))) {
    return "installed";
  }

  const discoveredFiles = collectRelativeFiles(destinationDir);
  if (discoveredFiles === null) {
    return "conflict";
  }

  const relevantFiles = discoveredFiles.filter((file) => !isIgnorableMarketplaceResidue(file));
  if (relevantFiles.length === 0) {
    return "recoverable";
  }

  const manifestPaths = new Set(files.map((file) => normalizeMarketplaceRelativePath(file.path)));
  return relevantFiles.every((file) => manifestPaths.has(normalizeMarketplaceRelativePath(file)))
    ? "recoverable"
    : "conflict";
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
  return path === ".DS_Store";
}

export async function publishMarketplaceSkill(options: MarketplaceSkillPublishOptions): Promise<{
  created: boolean;
  slug: string;
  packageName: string;
  fileCount: number;
}> {
  const {
    skillDir: rawSkillDir,
    slug: explicitSlug,
    metaFile,
    packageName: explicitPackageName,
    scope: explicitScope,
    name: explicitName,
    summary: explicitSummary,
    summaryI18n: explicitSummaryI18n,
    description: explicitDescription,
    descriptionI18n: explicitDescriptionI18n,
    tags: explicitTags,
    sourceRepo: explicitSourceRepo,
    homepage: explicitHomepage,
    publishedAt: explicitPublishedAt,
    updatedAt: explicitUpdatedAt,
    apiBaseUrl,
    token: explicitToken,
    requireExisting
  } = options;
  const skillDir = resolve(rawSkillDir);
  if (!existsSync(skillDir)) {
    throw new Error(`Skill directory not found: ${skillDir}`);
  }

  const files = collectFiles(skillDir);
  if (!files.some((file) => file.path === "SKILL.md")) {
    throw new Error(`Skill directory must include SKILL.md: ${skillDir}`);
  }

  const parsedFrontmatter = parseSkillFrontmatter(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
  const metadata = readMarketplaceMetadataFile(skillDir, metaFile);
  const slug = validateSkillSlug(explicitSlug?.trim() || metadata.slug || basename(skillDir), "slug");
  const name = explicitName?.trim() || metadata.name || parsedFrontmatter.name || slug;
  const description = explicitDescription?.trim()
    || metadata.description
    || metadata.descriptionI18n?.en
    || parsedFrontmatter.description;
  const summary = explicitSummary?.trim()
    || metadata.summary
    || metadata.summaryI18n?.en
    || parsedFrontmatter.summary
    || description
    || `${slug} skill`;
  const summaryI18n = buildLocalizedTextMap(summary, parsedFrontmatter.summaryI18n, metadata.summaryI18n, explicitSummaryI18n);
  const descriptionI18n = description
    ? buildLocalizedTextMap(description, parsedFrontmatter.descriptionI18n, metadata.descriptionI18n, explicitDescriptionI18n)
    : undefined;
  const tags = normalizeTags(explicitTags && explicitTags.length > 0 ? explicitTags : (metadata.tags ?? parsedFrontmatter.tags));

  const apiBase = resolveMarketplaceApiBase(apiBaseUrl);
  const adminToken = resolveMarketplaceAdminToken(explicitToken);
  const platformAuth = new PlatformAuthCommands();
  const currentUser = adminToken ? null : await platformAuth.me();
  const packageName = resolvePublishPackageName({
    explicitPackageName,
    explicitScope,
    slug,
    adminTokenPresent: Boolean(adminToken),
    currentUser
  });
  const authToken = adminToken ?? currentUser?.token;
  if (!authToken) {
    throw new Error("Publishing requires either a marketplace admin token or an active NextClaw platform login.");
  }

  const response = await runWithMarketplaceNetworkRetry(() =>
    fetch(`${apiBase}/api/v1/skills/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        slug,
        packageName,
        name,
        summary,
        summaryI18n,
        description,
        descriptionI18n,
        tags,
        sourceRepo: explicitSourceRepo?.trim() || metadata.sourceRepo,
        homepage: explicitHomepage?.trim() || metadata.homepage,
        publishedAt: explicitPublishedAt?.trim() || metadata.publishedAt,
        updatedAt: explicitUpdatedAt?.trim() || metadata.updatedAt,
        requireExisting,
        files
      })
    })
  );

  const payload = await readMarketplaceEnvelope<{
    created: boolean;
    fileCount: number;
    item?: {
      slug?: string;
      packageName?: string;
    };
  }>(response);

  if (!payload.ok || !payload.data) {
    const message = payload.error?.message || `marketplace publish failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    created: payload.data.created,
    slug: payload.data.item?.slug || slug,
    packageName: payload.data.item?.packageName || packageName,
    fileCount: payload.data.fileCount
  };
}

function collectFiles(rootDir: string): Array<{ path: string; contentBase64: string }> {
  const output: Array<{ path: string; contentBase64: string }> = [];

  const walk = (dir: string, prefix: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(absolute, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const content = readFileSync(absolute);
      output.push({
        path: relativePath,
        contentBase64: content.toString("base64")
      });
    }
  };

  walk(rootDir, "");
  return output;
}

function resolveBuiltinSkillDir(workdir: string, skillName: string): string {
  const loader = new SkillsLoader(workdir);
  const builtinSkill = loader.listSkills(false).find((skill) => skill.name === skillName && skill.source === "builtin");
  if (!builtinSkill) {
    throw new Error(`Built-in skill not found in local installation: ${skillName}`);
  }
  return dirname(builtinSkill.path);
}

function decodeMarketplaceFileContent(path: string, contentBase64: string): Buffer {
  const normalized = contentBase64.replace(/\s+/g, "");
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error(`Invalid marketplace file contentBase64 for path: ${path}`);
  }
  return Buffer.from(normalized, "base64");
}
