import type { NcpTool } from "@nextclaw/ncp";
import type {
  Config,
  DiagnosticRuntime,
  SearchConfig,
} from "@nextclaw/core";
import { classifyDiagnosticError } from "@nextclaw/shared";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/types/agent-run.types.js";

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

export class ToolProviderManager {
  private readonly providers = new Set<ToolProvider>();

  constructor(
    private readonly diagnostics?: Pick<DiagnosticRuntime, "record">,
  ) {}

  register = (provider: ToolProvider): (() => void) => {
    this.providers.add(provider);
    return () => {
      this.providers.delete(provider);
    };
  };

  buildTools = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const tools: NcpTool[] = [];
    const seen = new Set<string>();
    for (const provider of [...this.providers]) {
      for (const tool of await provider.provide(request)) {
        if (seen.has(tool.name)) {
          continue;
        }
        seen.add(tool.name);
        tools.push(this.wrapTool(tool, request));
      }
    }
    return tools;
  };

  dispose = (): void => {
    this.providers.clear();
  };

  private readonly wrapTool = (tool: NcpTool, request: AgentRunRequest): NcpTool => {
    if (!this.diagnostics) {
      return tool;
    }
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      supportsParallelToolCalls: tool.supportsParallelToolCalls,
      ...(tool.validateArgs ? { validateArgs: tool.validateArgs.bind(tool) } : {}),
      execute: async (args, context) => {
        const startedAt = Date.now();
        const correlationId = context?.toolCallId || request.correlationId;
        const parentCorrelationId = request.correlationId;
        this.diagnostics?.record({
          domain: "tool.execution",
          event: "tool.started",
          component: "kernel.tool-provider-manager",
          outcome: "started",
          correlationId,
          parentCorrelationId,
          facts: { toolName: tool.name },
        });
        try {
          const result = await tool.execute(args, context);
          this.diagnostics?.record({
            domain: "tool.execution",
            event: "tool.succeeded",
            component: "kernel.tool-provider-manager",
            outcome: "succeeded",
            correlationId,
            parentCorrelationId,
            durationMs: Date.now() - startedAt,
            facts: { toolName: tool.name },
          });
          return result;
        } catch (error) {
          const classification = classifyDiagnosticError(error, context?.abortSignal);
          this.diagnostics?.record({
            domain: "tool.execution",
            event: classification.outcome === "cancelled" ? "tool.cancelled" : "tool.failed",
            component: "kernel.tool-provider-manager",
            outcome: classification.outcome,
            correlationId,
            parentCorrelationId,
            durationMs: Date.now() - startedAt,
            reasonCode: classification.reasonCode,
            providerCode: classification.providerCode,
            facts: {
              toolName: tool.name,
              ...(classification.facts ?? {}),
            },
          });
          throw error;
        }
      },
    };
  };
}

export function resolveAgentHandoffDepth(metadata: Record<string, unknown>): number {
  const rawDepth = Number(metadata.agent_handoff_depth ?? 0);
  if (!Number.isFinite(rawDepth) || rawDepth < 0) {
    return 0;
  }
  return Math.trunc(rawDepth);
}
