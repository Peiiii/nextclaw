import { describe, expect, it, vi, beforeEach } from "vitest";
import { WebSearchTool } from "./web.js";
import type { SearchConfig } from "../../config/schema.js";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn()
}));

vi.mock("undici", () => ({
  fetch: mocks.fetch
}));

function createSearchConfig(): SearchConfig {
  return {
    provider: "tavily",
    enabledProviders: ["tavily"],
    defaults: {
      maxResults: 5
    },
    providers: {
      bocha: {
        apiKey: "",
        baseUrl: "https://api.bocha.cn/v1/web-search",
        summary: true,
        freshness: "noLimit",
        docsUrl: "https://open.bocha.cn"
      },
      tavily: {
        apiKey: "tvly_test_key",
        baseUrl: "https://api.tavily.com/search",
        searchDepth: "advanced",
        includeAnswer: true
      },
      brave: {
        apiKey: "",
        baseUrl: "https://api.search.brave.com/res/v1/web/search"
      }
    }
  };
}

describe("WebSearchTool", () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
  });

  it("calls Tavily with provider-specific payload and formats answer plus results", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "Hydrogen is the lightest chemical element.",
        results: [
          {
            title: "Hydrogen - Example",
            url: "https://example.com/hydrogen",
            content: "Hydrogen is the first element in the periodic table.",
            published_date: "2026-04-01",
            source: "Example Docs"
          }
        ]
      })
    });

    const tool = new WebSearchTool(createSearchConfig());
    const result = await tool.execute({ query: "what is hydrogen?", maxResults: 3 });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer tvly_test_key",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          query: "what is hydrogen?",
          max_results: 3,
          search_depth: "advanced",
          include_answer: true
        })
      })
    );
    expect(result).toContain("Answer: Hydrogen is the lightest chemical element.");
    expect(result).toContain("- Hydrogen - Example");
    expect(result).toContain("https://example.com/hydrogen");
    expect(result).toContain("Example Docs | 2026-04-01");
  });
});
