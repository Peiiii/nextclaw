import { loadConfig } from "@nextclaw/core";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  AgentRuntimeRegistry,
  BuiltinNarpRuntimeRegistrationService,
  DEFAULT_AGENT_RUNTIME_ENTRY_ID,
  resolveAgentRuntimeEntries,
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

function createUnusedRuntime(_params: RuntimeFactoryParams): NcpAgentRuntime {
  throw new Error("runtime creation is not available during runtime listing");
}

export async function listAvailableAgentRuntimes(
  params?: AgentRuntimeSessionTypeDescribeParams,
): Promise<AgentRuntimeListResult> {
  const config = loadConfig();
  const runtimeRegistry = new AgentRuntimeRegistry();
  const runtimeSourceByKind = new Map<string, {
    source: "builtin";
  }>();
  const runtimeSourceByEntryId = new Map<string, {
    source: "builtin";
  }>();

  runtimeRegistry.register({
    kind: DEFAULT_AGENT_RUNTIME_ENTRY_ID,
    label: "Native",
    createRuntime: createUnusedRuntime,
  });
  runtimeSourceByKind.set(DEFAULT_AGENT_RUNTIME_ENTRY_ID, {
    source: "builtin",
  });
  new BuiltinNarpRuntimeRegistrationService(() => config).registerInto({
    registerRuntimeProvider: runtimeRegistry.register,
  });
  runtimeSourceByKind.set("narp-http", {
    source: "builtin",
  });
  runtimeSourceByKind.set("narp-stdio", {
    source: "builtin",
  });

  const resolvedEntries = resolveAgentRuntimeEntries({
    config,
  });
  runtimeRegistry.applyEntries(resolvedEntries);
  for (const entry of resolvedEntries.entries) {
    const source = runtimeSourceByKind.get(entry.type);
    runtimeSourceByEntryId.set(entry.id, source ?? {
      source: "builtin",
    });
  }

  const listed = await runtimeRegistry.listSessionTypes(params);
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
