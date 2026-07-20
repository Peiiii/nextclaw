import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { runWithMarketplaceNetworkRetry } from "@nextclaw-service/utils/marketplace/marketplace-network-retry.utils.js";
import {
  hashMarketplaceFileBytes,
  isLocalMarketplaceInstallStateFile,
  type MarketplaceSkillInstallStateFileEntry
} from "@nextclaw-service/stores/marketplace-install-state.store.js";
import {
  DEFAULT_MARKETPLACE_API_BASE,
  getMarketplaceReadFetchOptions,
  MarketplaceRequestError,
  runMarketplaceReadSources,
  type MarketplaceReadResult
} from "@nextclaw-service/utils/marketplace/marketplace-read-source.utils.js";

export { resolveMarketplaceReadApiBases } from "@nextclaw-service/utils/marketplace/marketplace-read-source.utils.js";

type MarketplaceEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type MarketplaceSkillInstallKind = "builtin" | "marketplace";

export type MarketplaceSkillFileManifestEntry = {
  path: string;
  downloadPath?: string;
  contentBase64?: string;
};

export type MarketplaceSkillItem = {
  slug: string;
  packageName?: string;
  updatedAt?: string;
  install: { kind: MarketplaceSkillInstallKind };
};

export function resolveMarketplaceApiBase(explicitBase: string | undefined): string {
  const raw = explicitBase?.trim()
    || process.env.NEXTCLAW_MARKETPLACE_API_BASE?.trim()
    || DEFAULT_MARKETPLACE_API_BASE;
  return raw.replace(/\/+$/, "");
}

export function resolveMarketplaceAdminToken(explicitToken: string | undefined): string | undefined {
  const token = explicitToken?.trim() || process.env.NEXTCLAW_MARKETPLACE_ADMIN_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

export async function fetchMarketplaceSkillItem(
  apiBase: string,
  slug: string
): Promise<MarketplaceSkillItem> {
  return fetchMarketplaceSkillItemFromBase(apiBase, slug);
}

export async function fetchMarketplaceSkillItemFromSources(
  apiBases: readonly string[],
  slug: string,
): Promise<MarketplaceReadResult<MarketplaceSkillItem>> {
  return runMarketplaceReadSources(apiBases, (apiBase) => fetchMarketplaceSkillItemFromBase(apiBase, slug));
}

async function fetchMarketplaceSkillItemFromBase(
  apiBase: string,
  slug: string,
): Promise<MarketplaceSkillItem> {
  const fetchOptions = getMarketplaceReadFetchOptions(apiBase);
  return runWithMarketplaceNetworkRetry(async () => {
    const response = await fetch(`${apiBase}/api/v1/skills/items/${encodeURIComponent(slug)}`, {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(fetchOptions.timeoutMs),
    });
    const payload = await readMarketplaceEnvelope<{
      slug?: string;
      packageName?: string;
      updatedAt?: string;
      install: { kind: MarketplaceSkillInstallKind | string };
    }>(response);

    if (!payload.ok || !payload.data) {
      const message = payload.error?.message || `marketplace skill fetch failed: ${response.status}`;
      throw new MarketplaceRequestError(message, response.status);
    }

    const kind = payload.data.install?.kind;
    if (kind !== "builtin" && kind !== "marketplace") {
      throw new Error(`Unsupported skill install kind from marketplace: ${String(kind)}`);
    }

    return {
      slug: typeof payload.data.slug === "string" && payload.data.slug.trim()
        ? payload.data.slug.trim()
        : slug,
      packageName: typeof payload.data.packageName === "string" && payload.data.packageName.trim()
        ? payload.data.packageName.trim()
        : undefined,
      updatedAt: typeof payload.data.updatedAt === "string" && payload.data.updatedAt.trim()
        ? payload.data.updatedAt.trim()
        : undefined,
      install: {
        kind
      }
    };
  }, { attempts: fetchOptions.retryAttempts });
}

export async function fetchMarketplaceSkillFiles(
  apiBase: string,
  slug: string
): Promise<{ files: MarketplaceSkillFileManifestEntry[] }> {
  return fetchMarketplaceSkillFilesFromBase(apiBase, slug);
}

export async function fetchMarketplaceSkillFilesFromSources(
  apiBases: readonly string[],
  slug: string,
): Promise<MarketplaceReadResult<{ files: MarketplaceSkillFileManifestEntry[] }>> {
  return runMarketplaceReadSources(apiBases, (apiBase) => fetchMarketplaceSkillFilesFromBase(apiBase, slug));
}

async function fetchMarketplaceSkillFilesFromBase(
  apiBase: string,
  slug: string,
): Promise<{ files: MarketplaceSkillFileManifestEntry[] }> {
  const fetchOptions = getMarketplaceReadFetchOptions(apiBase);
  return runWithMarketplaceNetworkRetry(async () => {
    const response = await fetch(`${apiBase}/api/v1/skills/items/${encodeURIComponent(slug)}/files`, {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(fetchOptions.timeoutMs),
    });

    const payload = await readMarketplaceEnvelope<{ files: unknown }>(response);
    if (!payload.ok || !payload.data) {
      const message = payload.error?.message || `marketplace skill file fetch failed: ${response.status}`;
      throw new MarketplaceRequestError(message, response.status);
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
  }, { attempts: fetchOptions.retryAttempts });
}

export async function fetchMarketplaceSkillFileBlob(
  apiBase: string,
  slug: string,
  file: MarketplaceSkillFileManifestEntry
): Promise<Buffer> {
  const downloadUrl = resolveSkillFileDownloadUrl(apiBase, slug, file);
  const fetchOptions = getMarketplaceReadFetchOptions(apiBase);
  return runWithMarketplaceNetworkRetry(async () => {
    const response = await fetch(downloadUrl, {
      headers: {
        Accept: "application/octet-stream"
      },
      signal: AbortSignal.timeout(fetchOptions.timeoutMs),
    });
    if (!response.ok) {
      const message = extractMarketplaceErrorMessage(await response.text(), response.status)
        || `marketplace skill file download failed: ${response.status}`;
      throw new MarketplaceRequestError(message, response.status);
    }
    return Buffer.from(await response.arrayBuffer());
  }, { attempts: fetchOptions.retryAttempts });
}

async function fetchMarketplaceSkillFileBlobFromSources(
  apiBases: readonly string[],
  slug: string,
  file: MarketplaceSkillFileManifestEntry,
): Promise<Buffer> {
  const result = await runMarketplaceReadSources(
    apiBases,
    (apiBase) => fetchMarketplaceSkillFileBlob(apiBase, slug, file),
  );
  return result.data;
}

export function collectMarketplaceSkillFiles(rootDir: string): Array<{ path: string; contentBase64: string }> {
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
      if (isLocalMarketplaceInstallStateFile(relativePath)) {
        continue;
      }
      output.push({
        path: relativePath,
        contentBase64: readFileSync(absolute).toString("base64"),
      });
    }
  };

  walk(rootDir, "");
  return output;
}

export async function writeMarketplaceSkillFiles(params: {
  destinationDir: string;
  files: MarketplaceSkillFileManifestEntry[];
  apiBases: readonly string[];
  slug: string;
}): Promise<MarketplaceSkillInstallStateFileEntry[]> {
  const { destinationDir, files, apiBases, slug } = params;
  const resolvedFiles = await Promise.all(files.map(async (file) => {
    const targetPath = resolve(destinationDir, ...file.path.split("/"));
    const rel = relative(destinationDir, targetPath);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Invalid marketplace file path: ${file.path}`);
    }

    const bytes = file.contentBase64
      ? decodeMarketplaceFileContent(file.path, file.contentBase64)
      : await fetchMarketplaceSkillFileBlobFromSources(apiBases, slug, file);
    return { bytes, file, targetPath };
  }));

  return resolvedFiles.map(({ bytes, file, targetPath }) => {
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
    return {
      path: normalizeMarketplaceRelativePath(file.path),
      sha256: hashMarketplaceFileBytes(bytes),
    };
  });
}

export async function readMarketplaceEnvelope<T>(response: Response): Promise<MarketplaceEnvelope<T>> {
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

function resolveSkillFileDownloadUrl(
  apiBase: string,
  slug: string,
  file: MarketplaceSkillFileManifestEntry
): string {
  if (file.downloadPath) {
    return file.downloadPath.startsWith("http://") || file.downloadPath.startsWith("https://")
      ? file.downloadPath
      : `${apiBase}${file.downloadPath}`;
  }
  return `${apiBase}/api/v1/skills/items/${encodeURIComponent(slug)}/files/blob?path=${encodeURIComponent(file.path)}`;
}

function extractMarketplaceErrorMessage(raw: string, fallbackStatus: number): string | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const payload = JSON.parse(raw) as MarketplaceEnvelope<unknown>;
    return payload.error?.message;
  } catch {
    return raw || `Request failed (${fallbackStatus})`;
  }
}

function decodeMarketplaceFileContent(path: string, contentBase64: string): Buffer {
  const normalized = contentBase64.replace(/\s+/g, "");
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error(`Invalid marketplace file contentBase64 for path: ${path}`);
  }
  return Buffer.from(normalized, "base64");
}

function normalizeMarketplaceRelativePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
