import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { SkillsLoader } from "@nextclaw/core";
import {
  buildLocalizedTextMap,
  parseSkillFrontmatter,
  readMarketplaceMetadataFile,
  type LocalizedTextMap
} from "./marketplace.metadata.js";
import { runWithMarketplaceNetworkRetry } from "./marketplace-network-retry.js";

const DEFAULT_MARKETPLACE_API_BASE = "https://marketplace-api.nextclaw.io";

type MarketplaceEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type MarketplaceSkillInstallKind = "builtin" | "marketplace";
type MarketplaceSkillFileManifestEntry = {
  path: string;
  downloadPath?: string;
  contentBase64?: string;
};

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
  const slug = validateSkillSlug(options.slug.trim(), "slug");
  const workdir = resolve(options.workdir);
  if (!existsSync(workdir)) {
    throw new Error(`Workdir does not exist: ${workdir}`);
  }

  const dirName = options.dir?.trim() || "skills";
  const destinationDir = isAbsolute(dirName) ? resolve(dirName, slug) : resolve(workdir, dirName, slug);
  const skillFile = join(destinationDir, "SKILL.md");

  const apiBase = resolveMarketplaceApiBase(options.apiBaseUrl);
  const item = await fetchMarketplaceSkillItem(apiBase, slug);

  if (item.install.kind === "builtin") {
    if (!options.force && existsSync(destinationDir)) {
      if (existsSync(skillFile)) {
        return {
          slug,
          destinationDir,
          alreadyInstalled: true,
          source: "builtin"
        };
      }
      throw new Error(`Skill directory already exists: ${destinationDir} (use --force)`);
    }
    if (existsSync(destinationDir) && options.force) {
      rmSync(destinationDir, { recursive: true, force: true });
    }
    installBuiltinSkill(workdir, destinationDir, slug);
    return {
      slug,
      destinationDir,
      source: "builtin"
    };
  }

  const filesPayload = await fetchMarketplaceSkillFiles(apiBase, slug);

  if (!options.force && existsSync(destinationDir)) {
    const existingDirState = inspectMarketplaceSkillDirectory(destinationDir, filesPayload.files);
    if (existingDirState === "installed") {
      return {
        slug,
        destinationDir,
        alreadyInstalled: true,
        source: "marketplace"
      };
    }
    if (existingDirState === "recoverable") {
      rmSync(destinationDir, { recursive: true, force: true });
    } else {
      throw new Error(`Skill directory already exists: ${destinationDir} (use --force)`);
    }
  }

  if (existsSync(destinationDir) && options.force) {
    rmSync(destinationDir, { recursive: true, force: true });
  }
  mkdirSync(destinationDir, { recursive: true });

  for (const file of filesPayload.files) {
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

  if (!existsSync(join(destinationDir, "SKILL.md"))) {
    throw new Error(`Marketplace skill ${slug} does not include SKILL.md`);
  }

  return {
    slug,
    destinationDir,
    source: "marketplace"
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
  fileCount: number;
}> {
  const skillDir = resolve(options.skillDir);
  if (!existsSync(skillDir)) {
    throw new Error(`Skill directory not found: ${skillDir}`);
  }

  const files = collectFiles(skillDir);
  if (!files.some((file) => file.path === "SKILL.md")) {
    throw new Error(`Skill directory must include SKILL.md: ${skillDir}`);
  }

  const parsedFrontmatter = parseSkillFrontmatter(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
  const metadata = readMarketplaceMetadataFile(skillDir, options.metaFile);
  const slug = validateSkillSlug(options.slug?.trim() || metadata.slug || basename(skillDir), "slug");
  const name = options.name?.trim() || metadata.name || parsedFrontmatter.name || slug;
  const description = options.description?.trim()
    || metadata.description
    || metadata.descriptionI18n?.en
    || parsedFrontmatter.description;
  const summary = options.summary?.trim()
    || metadata.summary
    || metadata.summaryI18n?.en
    || parsedFrontmatter.summary
    || description
    || `${slug} skill`;
  const summaryI18n = buildLocalizedTextMap(summary, parsedFrontmatter.summaryI18n, metadata.summaryI18n, options.summaryI18n);
  const descriptionI18n = description
    ? buildLocalizedTextMap(description, parsedFrontmatter.descriptionI18n, metadata.descriptionI18n, options.descriptionI18n)
    : undefined;
  const author = options.author?.trim() || metadata.author || parsedFrontmatter.author || "nextclaw";
  const tags = normalizeTags(options.tags && options.tags.length > 0 ? options.tags : (metadata.tags ?? parsedFrontmatter.tags));

  const apiBase = resolveMarketplaceApiBase(options.apiBaseUrl);
  const token = resolveMarketplaceAdminToken(options.token);

  if (options.requireExisting) {
    await fetchMarketplaceSkillItem(apiBase, slug);
  }

  const response = await runWithMarketplaceNetworkRetry(() =>
    fetch(`${apiBase}/api/v1/admin/skills/upsert`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        slug,
        name,
        summary,
        summaryI18n,
        description,
        descriptionI18n,
        author,
        tags,
        sourceRepo: options.sourceRepo?.trim() || metadata.sourceRepo,
        homepage: options.homepage?.trim() || metadata.homepage,
        publishedAt: options.publishedAt?.trim() || metadata.publishedAt,
        updatedAt: options.updatedAt?.trim() || metadata.updatedAt,
        files
      })
    })
  );

  const payload = await readMarketplaceEnvelope<{ created: boolean; fileCount: number }>(response);

  if (!payload.ok || !payload.data) {
    const message = payload.error?.message || `marketplace publish failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    created: payload.data.created,
    slug,
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

function installBuiltinSkill(workdir: string, destinationDir: string, skillName: string): void {
  const loader = new SkillsLoader(workdir);
  const workspaceSkill = loader.listSkills(false).find((skill) => skill.name === skillName && skill.source === "workspace");
  if (!workspaceSkill) {
    throw new Error(`Workspace skill not found in local installation: ${skillName}`);
  }
  cpSync(dirname(workspaceSkill.path), destinationDir, { recursive: true, force: true });
}

async function fetchMarketplaceSkillItem(
  apiBase: string,
  slug: string
): Promise<{ install: { kind: MarketplaceSkillInstallKind } }> {
  return runWithMarketplaceNetworkRetry(async () => {
    const response = await fetch(`${apiBase}/api/v1/skills/items/${encodeURIComponent(slug)}`, {
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readMarketplaceEnvelope<{ install: { kind: MarketplaceSkillInstallKind | string } }>(response);

    if (!payload.ok || !payload.data) {
      const message = payload.error?.message || `marketplace skill fetch failed: ${response.status}`;
      throw new Error(message);
    }

    const kind = payload.data.install?.kind;
    if (kind !== "builtin" && kind !== "marketplace") {
      throw new Error(`Unsupported skill install kind from marketplace: ${String(kind)}`);
    }

    return {
      install: {
        kind
      }
    };
  });
}

async function fetchMarketplaceSkillFiles(
  apiBase: string,
  slug: string
): Promise<{ files: MarketplaceSkillFileManifestEntry[] }> {
  return runWithMarketplaceNetworkRetry(async () => {
    const response = await fetch(`${apiBase}/api/v1/skills/items/${encodeURIComponent(slug)}/files`, {
      headers: {
        Accept: "application/json"
      }
    });

    const payload = await readMarketplaceEnvelope<{ files: unknown }>(response);
    if (!payload.ok || !payload.data) {
      const message = payload.error?.message || `marketplace skill file fetch failed: ${response.status}`;
      throw new Error(message);
    }

    if (!isRecord(payload.data) || !Array.isArray(payload.data.files)) {
      throw new Error("Invalid marketplace skill file manifest response");
    }

    const files = payload.data.files.map((entry, index) => {
      if (!isRecord(entry) || typeof entry.path !== "string" || entry.path.trim().length === 0) {
        throw new Error(`Invalid marketplace skill file manifest at index ${index}`);
      }
      const normalized: MarketplaceSkillFileManifestEntry = {
        path: entry.path.trim()
      };
      if (typeof entry.downloadPath === "string" && entry.downloadPath.trim().length > 0) {
        normalized.downloadPath = entry.downloadPath.trim();
      }
      if (typeof entry.contentBase64 === "string" && entry.contentBase64.trim().length > 0) {
        normalized.contentBase64 = entry.contentBase64.trim();
      }
      return normalized;
    });

    return { files };
  });
}

async function fetchMarketplaceSkillFileBlob(
  apiBase: string,
  slug: string,
  file: MarketplaceSkillFileManifestEntry
): Promise<Buffer> {
  const downloadUrl = resolveSkillFileDownloadUrl(apiBase, slug, file);
  return runWithMarketplaceNetworkRetry(async () => {
    const response = await fetch(downloadUrl, {
      headers: {
        Accept: "application/octet-stream"
      }
    });
    if (!response.ok) {
      const message = await tryReadMarketplaceError(response);
      throw new Error(message || `marketplace skill file download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  });
}

function decodeMarketplaceFileContent(path: string, contentBase64: string): Buffer {
  const normalized = contentBase64.replace(/\s+/g, "");
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error(`Invalid marketplace file contentBase64 for path: ${path}`);
  }
  return Buffer.from(normalized, "base64");
}

function resolveSkillFileDownloadUrl(apiBase: string, slug: string, file: MarketplaceSkillFileManifestEntry): string {
  const fallback = `${apiBase}/api/v1/skills/items/${encodeURIComponent(slug)}/files/blob?path=${encodeURIComponent(file.path)}`;
  if (!file.downloadPath) {
    return fallback;
  }

  if (file.downloadPath.startsWith("http://") || file.downloadPath.startsWith("https://")) {
    return file.downloadPath;
  }

  const normalizedPath = file.downloadPath.startsWith("/") ? file.downloadPath : `/${file.downloadPath}`;
  return `${apiBase}${normalizedPath}`;
}

async function tryReadMarketplaceError(response: Response): Promise<string | undefined> {
  const raw = await response.text();
  if (!raw.trim()) {
    return undefined;
  }
  try {
    const payload = JSON.parse(raw) as MarketplaceEnvelope<unknown>;
    return payload.error?.message;
  } catch {
    return undefined;
  }
}

async function readMarketplaceEnvelope<T>(response: Response): Promise<MarketplaceEnvelope<T>> {
  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`Invalid marketplace response: ${response.status}`);
  }

  if (!isRecord(payload) || typeof payload.ok !== "boolean") {
    throw new Error(`Invalid marketplace response shape: ${response.status}`);
  }

  return payload as MarketplaceEnvelope<T>;
}

function resolveMarketplaceApiBase(explicitBase: string | undefined): string {
  const raw = explicitBase?.trim()
    || process.env.NEXTCLAW_MARKETPLACE_API_BASE?.trim()
    || DEFAULT_MARKETPLACE_API_BASE;
  return raw.replace(/\/+$/, "");
}

function resolveMarketplaceAdminToken(explicitToken: string | undefined): string | undefined {
  const token = explicitToken?.trim() || process.env.NEXTCLAW_MARKETPLACE_ADMIN_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

function validateSkillSlug(raw: string, fieldName: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(raw)) {
    throw new Error(`Invalid ${fieldName}: ${raw}`);
  }
  return raw;
}

function normalizeTags(rawTags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const rawTag of rawTags ?? []) {
    const tag = rawTag.trim();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    output.push(tag);
  }
  return output.length > 0 ? output : ["skill"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
