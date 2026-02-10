import { fetch } from "undici";
import { Tool } from "./base.js";

export class WebSearchTool extends Tool {
  constructor(private apiKey?: string | null, private maxResults = 5) {
    super();
  }

  get name(): string {
    return "web_search";
  }

  get description(): string {
    return "Search the web using Brave Search API";
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

  async execute(params: Record<string, unknown>): Promise<string> {
    if (!this.apiKey) {
      return "Error: Brave Search API key not configured";
    }
    const query = String(params.query ?? "");
    const maxResults = Number(params.maxResults ?? this.maxResults);
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));

    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": this.apiKey
      }
    });
    if (!response.ok) {
      return `Error: Brave Search request failed (${response.status})`;
    }
    const data = (await response.json()) as { web?: { results?: Array<Record<string, unknown>> } };
    const results = data.web?.results ?? [];
    if (!results.length) {
      return "No results found.";
    }
    const lines = results.map((item) => {
      const title = item.title ?? "";
      const urlValue = item.url ?? "";
      const description = item.description ?? "";
      return `- ${title}\n  ${urlValue}\n  ${description}`;
    });
    return lines.join("\n\n");
  }
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
    const response = await fetch(url, { headers: { "User-Agent": "nextbot" } });
    if (!response.ok) {
      return `Error: Fetch failed (${response.status})`;
    }
    const text = await response.text();
    return text.slice(0, 12000);
  }
}
