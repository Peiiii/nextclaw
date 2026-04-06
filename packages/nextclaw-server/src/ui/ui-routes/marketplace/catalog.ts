import type { MarketplaceItemView, MarketplaceListView } from "../../types.js";
import { readErrorMessage } from "../response.js";
import type { UiRouterOptions } from "../types.js";
import {
  DEFAULT_MARKETPLACE_API_BASE,
  MARKETPLACE_REMOTE_MAX_PAGES,
  MARKETPLACE_REMOTE_PAGE_SIZE,
  MARKETPLACE_ZH_COPY_BY_SLUG
} from "./constants.js";
import { runWithMarketplaceNetworkRetry } from "./marketplace-network-retry.js";

export function normalizeMarketplaceBaseUrl(options: UiRouterOptions): string {
  const configured = options.marketplace?.apiBaseUrl?.trim();
  if (!configured) {
    return DEFAULT_MARKETPLACE_API_BASE;
  }
  return configured.replace(/\/$/, "");
}

export function toMarketplaceUrl(baseUrl: string, path: string, query: Record<string, string | undefined> = {}): string {
  const url = new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export async function fetchMarketplaceData<T>(params: {
  baseUrl: string;
  path: string;
  query?: Record<string, string | undefined>;
}): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const endpoint = toMarketplaceUrl(params.baseUrl, params.path, params.query);
  let response: Response;
  try {
    response = await runWithMarketplaceNetworkRetry(() =>
      fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      })
    );
  } catch (error) {
    return {
      ok: false,
      status: 503,
      message: error instanceof Error ? error.message : String(error)
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `marketplace request failed (${response.status})`
      };
    }
    return {
      ok: false,
      status: 502,
      message: "invalid marketplace response"
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: readErrorMessage(payload, `marketplace request failed (${response.status})`)
    };
  }

  if (!payload || typeof payload !== "object" || !("ok" in payload)) {
    return {
      ok: false,
      status: 502,
      message: "invalid marketplace response"
    };
  }

  const typed = payload as {
    ok?: boolean;
    data?: T;
    error?: {
      message?: string;
    };
  };

  if (!typed.ok) {
    return {
      ok: false,
      status: 502,
      message: readErrorMessage(payload, "marketplace response returned error")
    };
  }

  return {
    ok: true,
    data: typed.data as T
  };
}

function sanitizeMarketplaceItem<T extends Record<string, unknown>>(item: T): T {
  const next = { ...item } as T;
  delete (next as { sourceType?: unknown }).sourceType;
  return next;
}

function readLocalizedMap(value: unknown): Record<string, string> {
  const localized: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return localized;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      continue;
    }
    localized[key] = entry.trim();
  }
  return localized;
}

function normalizeLocaleTag(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function pickLocaleFamilyValue(localized: Record<string, string>, localeFamily: string): string | undefined {
  const normalizedFamily = normalizeLocaleTag(localeFamily).split("-")[0];
  if (!normalizedFamily) {
    return undefined;
  }

  let familyMatch: string | undefined;
  for (const [locale, text] of Object.entries(localized)) {
    const normalizedLocale = normalizeLocaleTag(locale);
    if (!normalizedLocale) {
      continue;
    }
    if (normalizedLocale === normalizedFamily) {
      return text;
    }
    if (!familyMatch && normalizedLocale.startsWith(`${normalizedFamily}-`)) {
      familyMatch = text;
    }
  }

  return familyMatch;
}

function normalizeLocalizedTextMap(primaryText: string, localized: unknown, zhFallback?: string): Record<string, string> {
  const next = readLocalizedMap(localized);
  if (!next.en) {
    next.en = pickLocaleFamilyValue(next, "en") ?? primaryText;
  }
  if (!next.zh) {
    next.zh = pickLocaleFamilyValue(next, "zh")
      ?? (zhFallback && zhFallback.trim().length > 0 ? zhFallback.trim() : next.en);
  }
  return next;
}

export function normalizeMarketplaceItemForUi<T extends MarketplaceItemView | MarketplaceListView["items"][number]>(item: T): T {
  const zhCopy = MARKETPLACE_ZH_COPY_BY_SLUG[item.slug];
  const next = {
    ...item,
    summaryI18n: normalizeLocalizedTextMap(item.summary, (item as { summaryI18n?: unknown }).summaryI18n, zhCopy?.summary)
  } as T & {
    summaryI18n: Record<string, string>;
    descriptionI18n?: Record<string, string>;
  };

  if ("description" in item && typeof item.description === "string" && item.description.trim().length > 0) {
    next.descriptionI18n = normalizeLocalizedTextMap(
      item.description,
      (item as { descriptionI18n?: unknown }).descriptionI18n,
      zhCopy?.description
    );
  }

  return next as T;
}

export function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export async function fetchAllMarketplaceItems(params: {
  baseUrl: string;
  path: string;
  query?: Record<string, string | undefined>;
}): Promise<
  | { ok: true; data: { sort: MarketplaceListView["sort"]; query?: string; items: MarketplaceListView["items"] } }
  | { ok: false; status: number; message: string }
> {
  const items: MarketplaceListView["items"] = [];
  let sort: MarketplaceListView["sort"] = "relevance";
  let query: MarketplaceListView["query"];

  for (let page = 1; page <= MARKETPLACE_REMOTE_MAX_PAGES; page += 1) {
    const result = await fetchMarketplaceData<MarketplaceListView>({
      baseUrl: params.baseUrl,
      path: params.path,
      query: {
        ...params.query,
        page: String(page),
        pageSize: String(MARKETPLACE_REMOTE_PAGE_SIZE)
      }
    });

    if (!result.ok) {
      return result;
    }

    const pageItems = Array.isArray(result.data.items) ? result.data.items : [];
    if (pageItems.length === 0) {
      break;
    }

    sort = result.data.sort;
    query = result.data.query;
    items.push(...pageItems);

    const pageSize =
      typeof result.data.pageSize === "number" && Number.isFinite(result.data.pageSize) && result.data.pageSize > 0
        ? result.data.pageSize
        : MARKETPLACE_REMOTE_PAGE_SIZE;
    if (pageItems.length < pageSize) {
      break;
    }
  }

  return {
    ok: true,
    data: {
      sort,
      ...(typeof query === "string" ? { query } : {}),
      items
    }
  };
}

export async function fetchAllPluginMarketplaceItems(params: {
  baseUrl: string;
  query?: Record<string, string | undefined>;
}): Promise<
  | { ok: true; data: { sort: MarketplaceListView["sort"]; query?: string; items: MarketplaceListView["items"] } }
  | { ok: false; status: number; message: string }
> {
  return fetchAllMarketplaceItems({
    baseUrl: params.baseUrl,
    path: "/api/v1/plugins/items",
    query: params.query
  });
}

export async function fetchAllSkillMarketplaceItems(params: {
  baseUrl: string;
  query?: Record<string, string | undefined>;
}): Promise<
  | { ok: true; data: { sort: MarketplaceListView["sort"]; query?: string; items: MarketplaceListView["items"] } }
  | { ok: false; status: number; message: string }
> {
  return fetchAllMarketplaceItems({
    baseUrl: params.baseUrl,
    path: "/api/v1/skills/items",
    query: params.query
  });
}

export async function fetchAllMcpMarketplaceItems(params: {
  baseUrl: string;
  query?: Record<string, string | undefined>;
}): Promise<
  | { ok: true; data: { sort: MarketplaceListView["sort"]; query?: string; items: MarketplaceListView["items"] } }
  | { ok: false; status: number; message: string }
> {
  return fetchAllMarketplaceItems({
    baseUrl: params.baseUrl,
    path: "/api/v1/mcp/items",
    query: params.query
  });
}

export function sanitizeMarketplaceListItems(items: MarketplaceListView["items"]): MarketplaceListView["items"] {
  return items.map((item) => sanitizeMarketplaceItem(item));
}

export function sanitizeMarketplaceItemView(item: MarketplaceItemView): MarketplaceItemView {
  return sanitizeMarketplaceItem(item);
}
