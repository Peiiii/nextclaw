import {
  ConfigSchema, resolveConfiguredAgentProfiles, assertCreatableAgentId,
  insertConfiguredAgentProfile, removeConfiguredAgentProfile, normalizeAgentProfileId,
  ensureAgentProfileUpdateInput, applyAgentProfileTextUpdate, applyAgentProfileSettingsUpdate,
  type Config, type CreateAgentProfileInput, type UpdateAgentProfileInput,
} from "@nextclaw/core";
import type { AgentPlatform, AgentKernelResources, AgentProfilePersistence } from "@nextclaw/kernel";
import type { NcpLLMApi } from "@nextclaw/ncp";
import type { CompactionSummaryProvider } from "@nextclaw/kernel";
import { CloudflareSessionStore } from "../stores/cloudflare-session.store";
import { BIBO_DEFAULT_MODEL } from "./model/bibo-model-transport.service";

/** Cloud bindings and persisted configuration, without Agent runtime assembly. */
export class CloudflarePlatform implements AgentPlatform, AgentKernelResources {
  readonly sessions: CloudflareSessionStore;
  readonly profiles: AgentProfilePersistence;
  readonly runtimeInfo = { inspect: () => ({ appName: "nextclaw", host: "Cloudflare Worker", distribution: "cloudflare" }) };
  private config: Config | undefined;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly storage: DurableObjectStorage,
    readonly models: NcpLLMApi, readonly summaries: CompactionSummaryProvider,
    readonly contextFiles: NonNullable<AgentKernelResources["contextFiles"]>) {
    this.sessions = new CloudflareSessionStore(storage);
    this.profiles = {
      loadConfig: this.loadConfig,
      resolveHome: this.resolveHome,
      create: this.createProfile,
      update: this.updateProfile,
      remove: (id) => this.mutate((config) => removeConfiguredAgentProfile(config, id)),
    };
  }

  start = async (): Promise<AgentKernelResources> => {
    this.config = ConfigSchema.parse(await this.storage.get("agentConfig") ?? {
      agents: { defaults: { workspace: "/data/workspace", model: BIBO_DEFAULT_MODEL,
        contextTokens: 200_000, reservedContextTokens: 10_000 }, list: [{ id: "main", displayName: "Bibo", default: true }] },
    });
    return this;
  };
  dispose = async (): Promise<void> => { await this.writes; };
  resolveProjectContext: AgentKernelResources["resolveProjectContext"] = ({ workspace }) => ({
    hostWorkspace: workspace ?? "/data/workspace", effectiveWorkspace: workspace ?? "/data/workspace",
    projectRoot: null, projectBootstrapRoot: null, projectSkillsRoot: null,
  });
  projects: AgentKernelResources["projects"] = {
    normalizeSessionProjectContext: async (value) => {
      if (value == null || value === "") return null;
      throw new Error("Cloud sessions use named execution environments for OS projects.");
    },
  };
  // Durable session summaries are indexed by the session store on every commit.
  sessionSearch: AgentKernelResources["sessionSearch"] = { handleSessionUpdated: async () => {} };

  private loadConfig = (): Config => {
    if (!this.config) throw new Error("Cloudflare platform is not started.");
    return this.config;
  };
  private resolveHome = (config: Config, id: string): string =>
    `${config.agents.defaults.workspace.replace(/\/$/, "")}/agents/${id}`;

  private mutate = <T>(update: (config: Config) => T): Promise<T> => {
    const task = this.writes.then(async () => {
      const result = await this.storage.transaction(async (transaction) => {
        const config = ConfigSchema.parse(await transaction.get("agentConfig") ?? this.loadConfig());
        const value = update(config);
        const validated = ConfigSchema.parse(config);
        await transaction.put({ agentConfig: validated });
        return { config: validated, value };
      });
      this.config = result.config;
      return result.value;
    });
    this.writes = task.then(() => undefined, () => undefined);
    return task;
  };

  private createProfile = (input: CreateAgentProfileInput) => this.mutate((config) => {
    const id = assertCreatableAgentId(input.id);
    if (input.avatar) throw new Error("Cloud avatar assets are not configured.");
    insertConfiguredAgentProfile(config, input, { home: input.home?.trim() || this.resolveHome(config, id) });
    return resolveConfiguredAgentProfiles(config, this.resolveHome).find((entry) => entry.id === id)!;
  });

  private updateProfile = (input: UpdateAgentProfileInput) => this.mutate((config) => {
    const id = normalizeAgentProfileId(input.id);
    const current = resolveConfiguredAgentProfiles(config, this.resolveHome).find((entry) => entry.id === id);
    if (!current) throw new Error(`agent '${id}' not found`);
    ensureAgentProfileUpdateInput(input);
    if (input.avatar) throw new Error("Cloud avatar assets are not configured.");
    const index = config.agents.list.findIndex((entry) => normalizeAgentProfileId(entry.id) === id);
    const profile = index >= 0 ? { ...config.agents.list[index] } : { id, default: id === "main" };
    applyAgentProfileTextUpdate(profile, "displayName", input.displayName);
    applyAgentProfileTextUpdate(profile, "description", input.description);
    if (input.avatar !== undefined) delete profile.avatar;
    applyAgentProfileSettingsUpdate(profile, input);
    if (index >= 0) config.agents.list[index] = profile;
    else config.agents.list.push(profile);
    return resolveConfiguredAgentProfiles(config, this.resolveHome).find((entry) => entry.id === id)!;
  });
}
