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

export type MarketplaceSkillFileManifestEntry = {
  path: string;
  downloadPath?: string;
  contentBase64?: string;
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
): Promise<{ slug: string; packageName?: string; install: { kind: MarketplaceSkillInstallKind } }> {
  return runWithMarketplaceNetworkRetry(async () => {
    const response = await fetch(`${apiBase}/api/v1/skills/items/${encodeURIComponent(slug)}`, {
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readMarketplaceEnvelope<{
      slug?: string;
      packageName?: string;
      install: { kind: MarketplaceSkillInstallKind | string };
    }>(response);

    if (!payload.ok || !payload.data) {
      const message = payload.error?.message || `marketplace skill fetch failed: ${response.status}`;
      throw new Error(message);
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
      install: {
        kind
      }
    };
  });
}

export async function fetchMarketplaceSkillFiles(
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

export async function fetchMarketplaceSkillFileBlob(
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
      const message = extractMarketplaceErrorMessage(await response.text(), response.status)
        || `marketplace skill file download failed: ${response.status}`;
      throw new Error(message);
    }
    return Buffer.from(await response.arrayBuffer());
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
