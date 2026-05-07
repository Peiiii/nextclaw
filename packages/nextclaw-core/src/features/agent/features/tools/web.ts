import { fetch } from "undici";
import { Tool } from "./base.js";
import { APP_USER_AGENT } from "../../config/brand.js";
import type { SearchConfig, SearchProviderName } from "../../config/schema.js";

type SearchResultItem = {
  title: string;
  url: string;
  summary: string;
  siteName?: string;
  publishedAt?: string;
};

type SearchResultSet = {
  answer?: string;
  results: SearchResultItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getStringByKeys(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const segments = key.split(".");
    let current: unknown = source;
    for (const segment of segments) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[segment];
    }
    const value = toNonEmptyString(current);
    if (value) {
      return value;
    }
  }
  return null;
}

function normalizeBraveResults(payload: unknown): SearchResultSet {
  if (!isRecord(payload) || !isRecord(payload.web) || !Array.isArray(payload.web.results)) {
    return { results: [] };
  }
  const results: SearchResultItem[] = [];
  for (const entry of payload.web.results) {
    if (!isRecord(entry)) {
      continue;
    }
    const title = getStringByKeys(entry, ["title"]);
    const url = getStringByKeys(entry, ["url"]);
    if (!title || !url) {
      continue;
    }
    const item: SearchResultItem = {
      title,
      url,
      summary: getStringByKeys(entry, ["description"]) ?? ""
    };
    const siteName = getStringByKeys(entry, ["profile.name"]);
    const publishedAt = getStringByKeys(entry, ["page_age"]);
    if (siteName) {
      item.siteName = siteName;
    }
    if (publishedAt) {
      item.publishedAt = publishedAt;
    }
    results.push(item);
  }
  return { results };
}

function extractBochaItems(payload: unknown): unknown[] {
  if (!isRecord(payload)) {
    return [];
  }
  const directLists = [
    payload.data,
    payload.results,
    payload.webPages,
    isRecord(payload.data) ? payload.data.webPages : undefined,
    isRecord(payload.data) ? payload.data.results : undefined
  ];
  for (const candidate of directLists) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (isRecord(candidate) && Array.isArray(candidate.value)) {
      return candidate.value;
    }
  }
  return [];
}

function normalizeBochaResults(payload: unknown): SearchResultSet {
  const results: SearchResultItem[] = [];
  for (const entry of extractBochaItems(payload)) {
    if (!isRecord(entry)) {
      continue;
    }
    const title = getStringByKeys(entry, ["name", "title"]);
    const url = getStringByKeys(entry, ["url", "link"]);
    if (!title || !url) {
      continue;
    }
    const item: SearchResultItem = {
      title,
      url,
      summary: getStringByKeys(entry, ["summary", "snippet", "description"]) ?? ""
    };
    const siteName = getStringByKeys(entry, ["siteName", "site", "displayUrl"]);
    const publishedAt = getStringByKeys(entry, ["publishTime", "datePublished", "publishedAt"]);
    if (siteName) {
      item.siteName = siteName;
    }
    if (publishedAt) {
      item.publishedAt = publishedAt;
    }
    results.push(item);
  }
  return { results };
}

function normalizeTavilyResults(payload: unknown): SearchResultSet {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return { results: [] };
  }
  const results: SearchResultItem[] = [];
  for (const entry of payload.results) {
    if (!isRecord(entry)) {
      continue;
    }
    const title = getStringByKeys(entry, ["title"]);
    const url = getStringByKeys(entry, ["url"]);
    if (!title || !url) {
      continue;
    }
    const item: SearchResultItem = {
      title,
      url,
      summary: getStringByKeys(entry, ["content", "snippet"]) ?? ""
    };
    const siteName = getStringByKeys(entry, ["source", "domain"]);
    const publishedAt = getStringByKeys(entry, ["published_date"]);
    if (siteName) {
      item.siteName = siteName;
    }
    if (publishedAt) {
      item.publishedAt = publishedAt;
    }
    results.push(item);
  }
  return {
    answer: getStringByKeys(payload, ["answer"]) ?? undefined,
    results
  };
}

function formatResults(resultSet: SearchResultSet): string {
  const sections: string[] = [];
  if (resultSet.answer) {
    sections.push(`Answer: ${resultSet.answer}`);
  }
  if (resultSet.results.length > 0) {
    sections.push(
      resultSet.results
        .map((item) => {
          const meta = [item.siteName, item.publishedAt].filter(Boolean).join(" | ");
          const lines = [`- ${item.title}`, `  ${item.url}`];
          if (meta) {
            lines.push(`  ${meta}`);
          }
          if (item.summary) {
            lines.push(`  ${item.summary}`);
          }
          return lines.join("\n");
        })
        .join("\n\n")
    );
  }
  return sections.join("\n\n");
}

function normalizeSearchResults(provider: SearchProviderName, payload: unknown): SearchResultSet {
  if (provider === "bocha") {
    return normalizeBochaResults(payload);
  }
  if (provider === "tavily") {
    return normalizeTavilyResults(payload);
  }
  return normalizeBraveResults(payload);
}

async function readSearchErrorDetails(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const message = typeof payload.message === "string"
      ? payload.message
      : typeof payload.msg === "string"
        ? payload.msg
        : "";
    return message ? `: ${message}` : "";
  } catch {
    return "";
  }
}

export class WebSearchTool extends Tool {
  constructor(private readonly config?: SearchConfig | null) {
    super();
  }

  get name(): string {
    return "web_search";
  }

  get description(): string {
    return "Search the web using the configured search provider";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "integer", description: "Max results" }
      },
      required: ["query"]
    };
  }

  execute = async (params: Record<string, unknown>): Promise<string> => {
    const query = String(params.query ?? "");
    const provider = this.config?.provider ?? "bocha";
    const enabledProviders = this.config?.enabledProviders ?? [];
    const maxResults = Math.max(1, Math.min(50, Number(params.maxResults ?? this.config?.defaults.maxResults ?? 5)));
    if (!enabledProviders.includes(provider)) {
      return `Error: ${provider} search provider is not enabled`;
    }
    let response: Response;
    try {
      response = await this.executeByProvider(provider, query, maxResults);
    } catch (error) {
      return error instanceof Error ? `Error: ${error.message}` : `Error: ${String(error)}`;
    }
    if (!response.ok) {
      const details = await readSearchErrorDetails(response);
      return `Error: ${provider} search request failed (${response.status})${details}`;
    }
    const payload = (await response.json()) as unknown;
    const resultSet = normalizeSearchResults(provider, payload);
    if (!resultSet.answer && resultSet.results.length === 0) {
      return "No results found.";
    }
    return formatResults(resultSet);
  };

  private executeByProvider = async (
    provider: SearchProviderName,
    query: string,
    maxResults: number
  ): Promise<Response> => {
    if (provider === "bocha") {
      const bocha = this.config?.providers.bocha;
      if (!bocha?.apiKey) {
        throw new Error("Bocha API key not configured");
      }
      return fetch(bocha.baseUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${bocha.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          summary: bocha.summary,
          freshness: bocha.freshness,
          count: maxResults
        })
      });
    }
    if (provider === "tavily") {
      const tavily = this.config?.providers.tavily;
      if (!tavily?.apiKey) {
        throw new Error("Tavily API key not configured");
      }
      return fetch(tavily.baseUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${tavily.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: tavily.searchDepth,
          include_answer: tavily.includeAnswer
        })
      });
    }
    const brave = this.config?.providers.brave;
    if (!brave?.apiKey) {
      throw new Error("Brave API key not configured");
    }
    const url = new URL(brave.baseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    return fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": brave.apiKey
      }
    });
  };
}

export class WebFetchTool extends Tool {
  get name(): string {
    return "web_fetch";
  }

  get description(): string {
    return "Fetch the contents of a web page";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" }
      },
      required: ["url"]
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const url = String(params.url ?? "");
    const response = await fetch(url, { headers: { "User-Agent": APP_USER_AGENT } });
    if (!response.ok) {
      return `Error: Fetch failed (${response.status})`;
    }
    const text = await response.text();
    return text.slice(0, 12000);
  }
}
