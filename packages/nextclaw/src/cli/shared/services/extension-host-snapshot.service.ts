import type {
  OpenClawPluginTool,
  OpenClawPluginToolContext,
  PluginRegistry,
} from "@nextclaw/openclaw-compat";
import type {
  ExtensionHostChannelDescriptor,
  ExtensionHostLoadRequest,
  ExtensionHostSnapshot,
  ExtensionHostToolDescriptor,
} from "@/cli/shared/types/extension-host.types.js";

export function normalizeExtensionHostToolList(value: unknown): OpenClawPluginTool[] {
  if (!value) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.filter((entry): entry is OpenClawPluginTool => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const tool = entry as OpenClawPluginTool;
    return (
      typeof tool.name === "string" &&
      tool.name.trim().length > 0 &&
      tool.parameters !== undefined &&
      typeof tool.execute === "function"
    );
  });
}

export function normalizeExtensionHostSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      type: "object",
      properties: {},
      additionalProperties: true,
    };
  }
  return schema as Record<string, unknown>;
}

export function createExtensionHostRegistrationId(params: {
  kind: "tool" | "runtime";
  pluginId: string;
  source: string;
  index: number;
}): string {
  const { index, kind, pluginId, source } = params;
  return [kind, pluginId, index, source].join(":");
}

export function pickExtensionHostToolForAlias(params: {
  tools: OpenClawPluginTool[];
  alias: string;
  declaredNames: string[];
}): OpenClawPluginTool | null {
  const { alias, declaredNames, tools } = params;
  const byName = tools.find((tool) => tool.name === alias);
  if (byName) {
    return byName;
  }
  if (tools.length === 1) {
    return tools[0] ?? null;
  }
  if (declaredNames.length === tools.length) {
    const index = declaredNames.indexOf(alias);
    if (index >= 0 && index < tools.length) {
      return tools[index] ?? null;
    }
  }
  return tools[0] ?? null;
}

export class ExtensionHostSnapshotService {
  createSnapshot = (
    registry: PluginRegistry,
    request: ExtensionHostLoadRequest,
  ): ExtensionHostSnapshot => ({
    plugins: registry.plugins,
    diagnostics: registry.diagnostics,
    tools: this.createToolDescriptors(registry, request),
    channels: this.createChannelDescriptors(registry),
    ncpAgentRuntimes: registry.ncpAgentRuntimes.map((runtime, index) => ({
      registrationId: createExtensionHostRegistrationId({
        kind: "runtime",
        pluginId: runtime.pluginId,
        source: runtime.source,
        index,
      }),
      pluginId: runtime.pluginId,
      source: runtime.source,
      kind: runtime.kind,
      label: runtime.label,
      supportsEntryRuntime: typeof runtime.createRuntimeForEntry === "function",
      supportsEntryDescription: typeof runtime.describeSessionTypeForEntry === "function",
    })),
  });

  private createToolDescriptors = (
    registry: PluginRegistry,
    request: ExtensionHostLoadRequest,
  ): ExtensionHostToolDescriptor[] =>
    registry.tools.map((tool, index) => {
      const context: OpenClawPluginToolContext = {
        config: request.config,
        workspaceDir: request.workspaceDir,
      };
      const previews = normalizeExtensionHostToolList(tool.factory(context)).map((preview) => ({
        name: preview.name,
        ...(preview.label ? { label: preview.label } : {}),
        ...(preview.description ? { description: preview.description } : {}),
        parameters: normalizeExtensionHostSchema(preview.parameters),
      }));
      return {
        registrationId: createExtensionHostRegistrationId({
          kind: "tool",
          pluginId: tool.pluginId,
          source: tool.source,
          index,
        }),
        pluginId: tool.pluginId,
        source: tool.source,
        names: tool.names,
        optional: tool.optional,
        previews,
      };
    });

  private createChannelDescriptors = (registry: PluginRegistry): ExtensionHostChannelDescriptor[] =>
    registry.channels.map((registration) => ({
      pluginId: registration.pluginId,
      source: registration.source,
      channel: {
        id: registration.channel.id,
        ...(registration.channel.meta ? { meta: registration.channel.meta } : {}),
        ...(registration.channel.capabilities ? { capabilities: registration.channel.capabilities } : {}),
        ...(registration.channel.configSchema ? { configSchema: registration.channel.configSchema } : {}),
        hasOutboundText: typeof registration.channel.outbound?.sendText === "function",
        hasOutboundPayload: typeof registration.channel.outbound?.sendPayload === "function",
      },
    }));
}
