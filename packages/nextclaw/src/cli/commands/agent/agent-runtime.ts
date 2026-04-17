import { getWorkspacePath, loadConfig } from "@nextclaw/core";
import { loadOpenClawPlugins } from "@nextclaw/openclaw-compat";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { buildReservedPluginLoadOptions } from "../plugin/plugin-command-utils.js";
import {
  resolveDevPluginLoadingContext,
} from "../plugin/development-source/dev-plugin-overrides.utils.js";
import { resolveDevFirstPartyPluginDir } from "../plugin/development-source/first-party-plugin-load-paths.js";
import {
  DEFAULT_UI_NCP_RUNTIME_ENTRY_ID,
  UiNcpRuntimeRegistry,
  type UiNcpSessionTypeDescribeParams,
  type UiNcpSessionTypeOption,
} from "../ncp/ui-ncp-runtime-registry.js";
import { resolveUiNcpRuntimeEntries } from "../ncp/ui-ncp-runtime-entry-resolver.js";
import { BuiltinNarpRuntimeRegistrationService } from "../ncp/builtin-narp-runtime-registration.service.js";
import {
  NARP_HTTP_RUNTIME_KIND,
  NARP_STDIO_RUNTIME_KIND,
} from "../ncp/builtin-narp-runtime-types.js";
import {
  logPluginDiagnostics,
  toExtensionRegistry,
} from "../plugins.js";

export type AgentRuntimeListEntry = UiNcpSessionTypeOption & {
  default: boolean;
  source: "builtin" | "plugin";
  pluginId?: string;
};

export type AgentRuntimeListResult = {
  defaultRuntime: string;
  runtimes: AgentRuntimeListEntry[];
};

function createUnusedRuntime(_params: RuntimeFactoryParams): NcpAgentRuntime {
  throw new Error("runtime creation is not available during runtime listing");
}

function loadRuntimeOnlyPluginRegistry(config: ReturnType<typeof loadConfig>, workspaceDir: string) {
  const workspaceExtensionsDir = resolveDevFirstPartyPluginDir(process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR);
  const { configWithDevPluginOverrides, excludedRoots } = resolveDevPluginLoadingContext(
    config,
    workspaceExtensionsDir,
  );
  return loadOpenClawPlugins({
    config: configWithDevPluginOverrides,
    workspaceDir,
    includeBundled: false,
    kinds: ["agent-runtime"],
    excludeRoots: excludedRoots,
    ...buildReservedPluginLoadOptions(),
    logger: {
      info: (message) => console.log(message),
      warn: (message) => console.warn(message),
      error: (message) => console.error(message),
      debug: (message) => console.debug(message),
    },
  });
}

export async function listAvailableAgentRuntimes(
  params?: UiNcpSessionTypeDescribeParams,
): Promise<AgentRuntimeListResult> {
  const config = loadConfig();
  const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
  const pluginRegistry = loadRuntimeOnlyPluginRegistry(config, workspaceDir);
  logPluginDiagnostics(pluginRegistry);

  const extensionRegistry = toExtensionRegistry(pluginRegistry);
  const runtimeRegistry = new UiNcpRuntimeRegistry();
  const runtimeSourceByKind = new Map<string, {
    source: "builtin" | "plugin";
    pluginId?: string;
  }>();
  const runtimeSourceByEntryId = new Map<string, {
    source: "builtin" | "plugin";
    pluginId?: string;
  }>();

  runtimeRegistry.register({
    kind: DEFAULT_UI_NCP_RUNTIME_ENTRY_ID,
    label: "Native",
    createRuntime: createUnusedRuntime,
  });
  runtimeSourceByKind.set(DEFAULT_UI_NCP_RUNTIME_ENTRY_ID, {
    source: "builtin",
  });
  new BuiltinNarpRuntimeRegistrationService(() => config).registerInto(runtimeRegistry);
  runtimeSourceByKind.set("narp-http", {
    source: "builtin",
  });
  runtimeSourceByKind.set("narp-stdio", {
    source: "builtin",
  });

  for (const registration of extensionRegistry.ncpAgentRuntimes) {
    const normalizedKind = registration.kind.trim().toLowerCase();
    if (
      normalizedKind === NARP_HTTP_RUNTIME_KIND ||
      normalizedKind === NARP_STDIO_RUNTIME_KIND
    ) {
      continue;
    }
    runtimeRegistry.register({
      kind: registration.kind,
      label: registration.label,
      createRuntime: registration.createRuntime,
      describeSessionType: registration.describeSessionType,
    });
    runtimeSourceByKind.set(registration.kind, {
      source: "plugin",
      pluginId: registration.pluginId,
    });
  }

  const resolvedEntries = resolveUiNcpRuntimeEntries({
    config,
    providerKinds: runtimeRegistry.listProviderKinds(),
  });
  runtimeRegistry.applyEntries(resolvedEntries);
  for (const entry of resolvedEntries.entries) {
    const source = runtimeSourceByKind.get(entry.type);
    runtimeSourceByEntryId.set(entry.id, source ?? {
      source: entry.id === DEFAULT_UI_NCP_RUNTIME_ENTRY_ID ? "builtin" : "plugin",
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
        source: source?.source ?? "plugin",
        ...(source?.pluginId ? { pluginId: source.pluginId } : {}),
      };
    }),
  };
}
