import { loadConfig } from "@nextclaw/core";
import {
  BuiltinNarpRuntimeProviderService,
  DEFAULT_AGENT_RUNTIME_ENTRY_ID,
  describeAgentRuntimeSessionTypes,
  resolveAgentRuntimeEntries,
  type AgentRuntimeSessionTypeProvider,
  type AgentRuntimeSessionTypeDescribeParams,
  type AgentRuntimeSessionTypeOption,
} from "@nextclaw/kernel";

export type AgentRuntimeListEntry = AgentRuntimeSessionTypeOption & {
  default: boolean;
  source: "builtin";
};

export type AgentRuntimeListResult = {
  defaultRuntime: string;
  runtimes: AgentRuntimeListEntry[];
};

export async function listAvailableAgentRuntimes(
  params?: AgentRuntimeSessionTypeDescribeParams,
): Promise<AgentRuntimeListResult> {
  const config = loadConfig();
  const providers = new Map<string, AgentRuntimeSessionTypeProvider>();
  const runtimeSourceByKind = new Map<
    string,
    {
      source: "builtin";
    }
  >();
  const runtimeSourceByEntryId = new Map<
    string,
    {
      source: "builtin";
    }
  >();

  providers.set(DEFAULT_AGENT_RUNTIME_ENTRY_ID, {});
  runtimeSourceByKind.set(DEFAULT_AGENT_RUNTIME_ENTRY_ID, {
    source: "builtin",
  });
  for (const provider of new BuiltinNarpRuntimeProviderService({
    loadConfig: () => config,
  }).createProviders()) {
    providers.set(provider.kind, provider);
  }
  runtimeSourceByKind.set("narp-http", {
    source: "builtin",
  });
  runtimeSourceByKind.set("narp-stdio", {
    source: "builtin",
  });

  const resolvedEntries = resolveAgentRuntimeEntries({
    config,
  });
  for (const entry of resolvedEntries.entries) {
    const source = runtimeSourceByKind.get(entry.type);
    runtimeSourceByEntryId.set(
      entry.id,
      source ?? {
        source: "builtin",
      },
    );
  }

  const listed = await describeAgentRuntimeSessionTypes({
    entries: resolvedEntries.entries,
    providers,
    defaultEntryId: resolvedEntries.defaultEntryId,
    describeParams: params,
  });
  return {
    defaultRuntime: listed.defaultType,
    runtimes: listed.options.map((runtime) => {
      const source = runtimeSourceByEntryId.get(runtime.value);
      return {
        ...runtime,
        default: runtime.value === listed.defaultType,
        source: source?.source ?? "builtin",
      };
    }),
  };
}
