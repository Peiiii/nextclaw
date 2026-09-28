import type { NcpTool } from "@nextclaw/ncp";
import { biboSearchRoute } from "@/features/search";

const searchParameters = { type: "object", properties: {
  query: { type: "string", description: "Search query" },
  maxResults: { type: "integer", description: "Max results" },
}, required: ["query"] } as const;
const fetchParameters = { type: "object", properties: { url: { type: "string", description: "URL to fetch" } }, required: ["url"] } as const;

function args(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatExaResults(payload: { results?: unknown[] }): string {
  if (!Array.isArray(payload.results) || payload.results.length === 0) return "No results found.";
  return payload.results.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const result = raw as Record<string, unknown>;
    if (typeof result.title !== "string" || typeof result.url !== "string") return [];
    const meta = [result.author, result.publishedDate].filter((part) => typeof part === "string" && part.trim()).join(" | ");
    const highlights = Array.isArray(result.highlights) ? result.highlights.filter((part) => typeof part === "string").join("\n") : "";
    const summary = highlights || (typeof result.text === "string" ? result.text : "");
    return [[`- ${result.title}`, `  ${result.url}`, ...(meta ? [`  ${meta}`] : []), ...(summary ? [`  ${summary}`] : [])].join("\n")];
  }).join("\n\n") || "No results found.";
}

/** Bibo network and quota adapter for the common NCP web tool contract. */
export function createBiboEdgeWebTools(env: Env, userId: string, token: string): NcpTool[] {
  return [
    {
      name: "web_search", description: "Search the web using the configured search provider",
      modelParameters: searchParameters, supportsParallelToolCalls: true,
      validateArgs: (value) => typeof value.query === "string" && value.query.trim() ? [] : ["query is required"],
      execute: async (raw) => {
        const input = args(raw);
        const count = Math.max(1, Math.min(10, Number(input.maxResults ?? 10)));
        const response = await biboSearchRoute(new Request("https://app.bibo.bot/api/search/exa", {
          method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ query: String(input.query ?? ""), numResults: count }),
        }), env, async (candidate) => candidate === token ? { id: userId } : null);
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { message?: string } | null;
          return `Error: exa search request failed (${response.status})${detail?.message ? `: ${detail.message}` : ""}`;
        }
        return formatExaResults(await response.json() as { results?: unknown[] });
      },
    },
    {
      name: "web_fetch", description: "Fetch the contents of a web page",
      modelParameters: fetchParameters, supportsParallelToolCalls: true,
      validateArgs: (value) => typeof value.url === "string" && value.url.trim() ? [] : ["url is required"],
      execute: async (raw) => {
        const input = args(raw);
        const response = await fetch(String(input.url ?? ""), { headers: { "User-Agent": "nextclaw" } });
        return response.ok ? (await response.text()).slice(0, 12_000) : `Error: Fetch failed (${response.status})`;
      },
    },
  ];
}
