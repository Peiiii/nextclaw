import { describe, expect, it } from "vitest";
import { ToolingContextProvider } from "../tooling-context.provider.js";

function createContext(params: {
  apiKey?: string;
  includeWebSearch?: boolean;
  provider?: "bocha" | "tavily" | "brave";
}) {
  const provider = params.provider ?? "bocha";
  return {
    resolve: async () => ({
      runContext: {
        profile: {
          searchConfig: {
            provider,
            enabledProviders: [provider],
            providers: {
              bocha: { apiKey: provider === "bocha" ? params.apiKey ?? "" : "" },
              tavily: { apiKey: provider === "tavily" ? params.apiKey ?? "" : "" },
              brave: { apiKey: provider === "brave" ? params.apiKey ?? "" : "" },
            },
          },
        },
      },
      toolCatalog: params.includeWebSearch === false
        ? [{ name: "exec", description: "Run a command" }]
        : [{ name: "web_search", description: "Search the web" }],
    }),
  };
}

describe("ToolingContextProvider web access policy", () => {
  it("marks an unconfigured provider as not ready and exposes the browser path", async () => {
    const provider = new ToolingContextProvider(createContext({}) as never);

    const blocks = await provider.provide({} as never);
    const context = blocks.join("\n");

    expect(context).toContain("web_search is not ready: provider bocha has no API key configured.");
    expect(context).toContain("web_search and Agent Browser are distinct capabilities");
    expect(context).toContain("Agent Browser means the external agent-browser CLI");
    expect(context).toContain("Chrome/Edge DevTools MCP");
    expect(context).toContain("read and follow the builtin agent-browser skill");
    expect(context).toContain("do not silently install its external CLI");
  });

  it("marks a configured provider as ready", async () => {
    const provider = new ToolingContextProvider(createContext({
      apiKey: "tvly_test_key",
      provider: "tavily",
    }) as never);

    const blocks = await provider.provide({} as never);

    expect(blocks.join("\n")).toContain("web_search is ready with provider tavily.");
  });

  it("does not claim readiness when web_search is absent from the turn", async () => {
    const provider = new ToolingContextProvider(createContext({
      apiKey: "configured",
      includeWebSearch: false,
    }) as never);

    const blocks = await provider.provide({} as never);

    expect(blocks.join("\n")).toContain("web_search is unavailable in this turn.");
  });
});
