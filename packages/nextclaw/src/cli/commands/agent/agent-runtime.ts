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
  DEFAULT_UI_NCP_RUNTIME_KIND,
  UiNcpRuntimeRegistry,
  type UiNcpSessionTypeDescribeParams,
  type UiNcpSessionTypeOption,
} from "../ncp/ui-ncp-runtime-registry.js";
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
  const runtimeRegistry = new UiNcpRuntimeRegistry(DEFAULT_UI_NCP_RUNTIME_KIND);
  const runtimeSourceByKind = new Map<string, {
    source: "builtin" | "plugin";
    pluginId?: string;
  }>();

  runtimeRegistry.register({
    kind: DEFAULT_UI_NCP_RUNTIME_KIND,
    label: "Native",
    createRuntime: createUnusedRuntime,
  });
  runtimeSourceByKind.set(DEFAULT_UI_NCP_RUNTIME_KIND, {
    source: "builtin",
  });

  for (const registration of extensionRegistry.ncpAgentRuntimes) {
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

  const listed = await runtimeRegistry.listSessionTypes(params);
  return {
    defaultRuntime: listed.defaultType,
    runtimes: listed.options.map((runtime) => {
      const source = runtimeSourceByKind.get(runtime.value);
      return {
        ...runtime,
        default: runtime.value === listed.defaultType,
        source: source?.source ?? "plugin",
        ...(source?.pluginId ? { pluginId: source.pluginId } : {}),
      };
    }),
  };
}
