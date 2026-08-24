import { describe, expect, it } from "vitest";
import { ToolingContextProvider } from "@kernel/contributions/context-provider/providers/tooling-context.provider.js";

function createContext(params: {
  apiKey?: string;
  includeWebSearch?: boolean;
  includeSessionSpawn?: boolean;
  provider?: "bocha" | "tavily" | "brave" | "exa";
}) {
  const provider = params.provider ?? "bocha";
  const toolCatalog = params.includeWebSearch === false
    ? [{ name: "exec", description: "Run a command" }]
    : [{ name: "web_search", description: "Search the web" }];
  if (params.includeSessionSpawn) {
    toolCatalog.push({ name: "sessions_spawn", description: "Create a session" });
  }
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
              exa: { apiKey: provider === "exa" ? params.apiKey ?? "" : "" },
            },
          },
        },
      },
      toolCatalog,
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

  it.each(["tavily", "exa"] as const)("marks configured %s search as ready", async (providerName) => {
    const provider = new ToolingContextProvider(createContext({
      apiKey: "search_test_key",
      provider: providerName,
    }) as never);

    const blocks = await provider.provide({} as never);

    expect(blocks.join("\n")).toContain(`web_search is ready with provider ${providerName}.`);
  });

  it("does not claim readiness when web_search is absent from the turn", async () => {
    const provider = new ToolingContextProvider(createContext({
      apiKey: "configured",
      includeWebSearch: false,
    }) as never);

    const blocks = await provider.provide({} as never);

    expect(blocks.join("\n")).toContain("web_search is unavailable in this turn.");
  });

  it("only recommends delegation when session creation is available", async () => {
    const rootProvider = new ToolingContextProvider(createContext({
      includeSessionSpawn: true,
    }) as never);
    const childProvider = new ToolingContextProvider(createContext({}) as never);

    expect((await rootProvider.provide({} as never)).join("\n")).toContain(
      "If a task is more complex or takes longer, spawn a sub-agent.",
    );
    const childContext = (await childProvider.provide({} as never)).join("\n");
    expect(childContext).not.toContain(
      "If a task is more complex or takes longer, spawn a sub-agent.",
    );
    expect(childContext).toContain(
      "Sub-agent spawning is unavailable in this delegated session",
    );
  });
});
