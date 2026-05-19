import {
  ToolRegistry,
  createToolExecutionContext,
  type Config,
  type ExtensionToolContext,
  type SearchConfig,
  type Tool,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpTool, NcpToolDefinition, NcpToolRegistry } from "@nextclaw/ncp";
import { isRecord } from "@kernel/utils/ncp-message-bridge.utils.js";

export type UpdateToolCallResult = (params: {
  sessionId: string;
  toolCallId: string;
  result: unknown;
}) => Promise<void>;

export type ToolRunContext = {
  agentId: string;
  channel: string;
  chatId: string;
  config: Config;
  execTimeoutSeconds: number;
  handoffDepth: number;
  metadata: Record<string, unknown>;
  restrictToWorkspace: boolean;
  searchConfig: SearchConfig;
  sessionId: string;
  workspace: string;
};

export type ToolRegistrationContext = {
  registerTool: (tool: Tool) => void;
  registerNcpTool: (tool: NcpTool) => void;
  hasTool: (name: string) => boolean;
  getExtensionToolRunContext: () => ExtensionToolContext;
};

export type ToolProvider = {
  id: string;
  registerTools: (context: ToolRunContext, registry: ToolRegistrationContext) => void;
};

export type ToolRuntimeRegistryOptions = {
  updateToolCallResult: UpdateToolCallResult;
};

export type ToolRuntimeRegistry = NcpToolRegistry & {
  prepareForRun: (context: ToolRunContext) => void;
};

function toToolParams(args: unknown): Record<string, unknown> {
  if (isRecord(args)) {
    return args;
  }
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args) as unknown;
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

class CoreToolNcpAdapter implements NcpTool {
  constructor(private readonly tool: Tool, private readonly executeTool: (toolName: string, args: unknown) => Promise<unknown>) {}

  get name(): string {
    return this.tool.name;
  }

  get description(): string {
    return this.tool.description;
  }

  get parameters(): Record<string, unknown> {
    return this.tool.parameters;
  }

  execute = async (args: unknown): Promise<unknown> => {
    return this.executeTool(this.tool.name, args);
  };
}

class RuntimeToolRegistry implements ToolRuntimeRegistry {
  private registry = new ToolRegistry();
  private readonly tools = new Map<string, NcpTool>();
  private currentExtensionToolContext: ExtensionToolContext = {};

  constructor(
    private readonly getProviders: () => ToolProvider[],
    private readonly options: ToolRuntimeRegistryOptions,
  ) {}

  prepareForRun = (context: ToolRunContext): void => {
    const {
      channel,
      chatId,
      config,
      restrictToWorkspace,
      sessionId,
      workspace,
    } = context;
    this.currentExtensionToolContext = {
      config,
      workspaceDir: workspace,
      sessionKey: sessionId,
      channel,
      chatId,
      sandboxed: restrictToWorkspace,
    };

    this.registry = new ToolRegistry();
    this.tools.clear();

    const registrationContext = this.createRegistrationContext();
    for (const provider of this.getProviders()) {
      provider.registerTools(context, registrationContext);
    }
  };

  listTools = (): ReadonlyArray<NcpTool> => {
    return [...this.tools.values()].filter((tool) => this.isToolAvailable(tool.name));
  };

  getTool = (name: string): NcpTool | undefined => {
    if (!this.isToolAvailable(name)) {
      return undefined;
    }
    return this.tools.get(name);
  };

  getToolDefinitions = (): ReadonlyArray<NcpToolDefinition> => {
    return this.listTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  };

  execute = async (toolCallId: string, toolName: string, args: unknown): Promise<unknown> => {
    if (this.registry.has(toolName)) {
      return this.registry.executeRaw(
        toolName,
        toToolParams(args),
        this.buildToolExecutionContext(toolCallId),
      );
    }
    return this.tools.get(toolName)?.execute(args);
  };

  private buildToolExecutionContext = (toolCallId: string): ToolExecutionContext => {
    const sessionId = this.currentExtensionToolContext.sessionKey;
    return createToolExecutionContext({
      toolCallId,
      updateToolCallResult: async (result: unknown) => {
        if (!sessionId) {
          return;
        }
        await this.options.updateToolCallResult({
          sessionId,
          toolCallId,
          result,
        });
      },
    });
  };

  private createRegistrationContext = (): ToolRegistrationContext => ({
    registerTool: this.registerTool,
    registerNcpTool: this.registerNcpTool,
    hasTool: (name) => this.tools.has(name),
    getExtensionToolRunContext: () => this.currentExtensionToolContext,
  });

  private registerTool = (tool: Tool): void => {
    this.registry.register(tool);
    this.tools.set(
      tool.name,
      new CoreToolNcpAdapter(tool, async (toolName, args) =>
        this.registry.execute(toolName, toToolParams(args)),
      ),
    );
  };

  private registerNcpTool = (tool: NcpTool): void => {
    if (this.tools.has(tool.name)) {
      return;
    }
    this.tools.set(tool.name, tool);
  };

  private isToolAvailable = (name: string): boolean => {
    const coreTool = this.registry.get(name);
    return coreTool ? coreTool.isAvailable() : true;
  };
}

export class ToolManager {
  private readonly providers = new Map<string, ToolProvider>();

  provideTools = (provider: ToolProvider): { dispose: () => void } => {
    if (this.providers.has(provider.id)) {
      throw new Error(`Tool provider is already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    return {
      dispose: () => {
        if (this.providers.get(provider.id) === provider) {
          this.providers.delete(provider.id);
        }
      },
    };
  };

  createRuntimeRegistry = (options: ToolRuntimeRegistryOptions): ToolRuntimeRegistry => {
    return new RuntimeToolRegistry(() => [...this.providers.values()], options);
  };

}

export function resolveAgentHandoffDepth(metadata: Record<string, unknown>): number {
  const rawDepth = Number(metadata.agent_handoff_depth ?? 0);
  if (!Number.isFinite(rawDepth) || rawDepth < 0) {
    return 0;
  }
  return Math.trunc(rawDepth);
}
