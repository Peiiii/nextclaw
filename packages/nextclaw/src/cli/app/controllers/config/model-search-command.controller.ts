import type { ConfigView, SearchConfigUpdate, SearchConfigView, SearchProviderName } from "@nextclaw/server";
import type { UiApiClient } from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";
import {
  printConfigResult, readConfigApiKey, requireConfigApiClient, requireConfigChange,
} from "@nextclaw-cli/cli/app/utils/config-command-options.utils.js";

type SearchOptions = { provider?: SearchProviderName; enabledProvider?: SearchProviderName[]; clearEnabledProviders?: boolean; maxResults?: number };
type SearchProviderOptions = {
  apiKeyEnv?: string; clearApiKey?: boolean; baseUrl?: string; docsUrl?: string;
  summary?: boolean; freshness?: string; searchDepth?: "basic" | "advanced"; includeAnswer?: boolean;
};

export class ModelSearchCommandController {
  constructor(private readonly createApi: () => UiApiClient = requireConfigApiClient) {}

  listModels = async (): Promise<void> => {
    printConfigResult(await this.createApi().request({ path: "/api/provider-model-catalog" }));
  };

  showModel = async (): Promise<void> => {
    const config = await this.createApi().request<ConfigView>({ path: "/api/config" });
    printConfigResult({ model: config.agents.defaults.model });
  };

  setModel = async (model: string): Promise<void> => {
    if (!model.trim()) throw new Error("Model must not be empty.");
    printConfigResult(await this.createApi().request({ path: "/api/config/model", method: "PUT", body: { model } }));
  };

  showSearch = async (): Promise<void> => {
    const config = await this.createApi().request<ConfigView>({ path: "/api/config" });
    printConfigResult(config.search);
  };

  configureSearch = async (options: SearchOptions): Promise<void> => {
    const { provider, enabledProvider, clearEnabledProviders, maxResults } = options;
    const patch: SearchConfigUpdate = {};
    if (provider !== undefined) patch.provider = provider;
    if (enabledProvider !== undefined) patch.enabledProviders = enabledProvider;
    if (clearEnabledProviders) {
      if (enabledProvider) throw new Error("Choose --enabled-provider or --clear-enabled-providers, not both.");
      patch.enabledProviders = [];
    }
    if (maxResults !== undefined) patch.defaults = { maxResults };
    await this.updateSearch(patch);
  };

  configureSearchProvider = async (provider: SearchProviderName, options: SearchProviderOptions): Promise<void> => {
    const patch: Record<string, unknown> = {};
    const apiKey = readConfigApiKey(options);
    if (apiKey !== undefined) patch.apiKey = apiKey;
    if (options.baseUrl !== undefined) patch.baseUrl = options.baseUrl || null;
    const bochaFields = ["docsUrl", "summary", "freshness"] as const;
    const tavilyFields = ["searchDepth", "includeAnswer"] as const;
    for (const field of bochaFields) {
      if (options[field] === undefined) continue;
      if (provider !== "bocha") throw new Error(`${field} is only supported by bocha.`);
      patch[field] = options[field];
    }
    for (const field of tavilyFields) {
      if (options[field] === undefined) continue;
      if (provider !== "tavily") throw new Error(`${field} is only supported by tavily.`);
      patch[field] = options[field];
    }
    requireConfigChange(patch);
    await this.updateSearch({ providers: { [provider]: patch } });
  };

  private updateSearch = async (patch: SearchConfigUpdate): Promise<void> => {
    requireConfigChange(patch);
    printConfigResult(await this.createApi().request<SearchConfigView>({ path: "/api/config/search", method: "PUT", body: patch }));
  };
}
