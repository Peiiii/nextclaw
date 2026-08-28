import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import type { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import type { ServiceAction } from "@kernel/types/service-app.types.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { buildServiceActionToolName } from "@kernel/utils/service-action-tool.utils.js";
import type { NcpTool } from "@nextclaw/ncp";

const EMPTY_OBJECT_SCHEMA: NcpTool["parameters"] = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export class ServiceActionToolProvider implements ToolProvider {
  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly serviceAppManager: ServiceAppManager,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await this.runContextService.resolve(request);
    const caller = { surface: "agent", agentId: toolRunContext.agentId } as const;
    const actions = await this.serviceAppManager.listServiceActions({ caller });
    return actions
      .filter((action) => action.grantState === "granted")
      .map((action) => this.toTool(caller, action));
  };

  private toTool = (
    caller: { surface: "agent"; agentId: string },
    action: ServiceAction,
  ): NcpTool => ({
    name: buildServiceActionToolName(action.id),
    description: [
      action.title ?? action.name,
      action.description,
      `NextClaw Service Action: ${action.id}`,
    ].filter(Boolean).join("\n"),
    parameters: action.inputSchema ?? EMPTY_OBJECT_SCHEMA,
    supportsParallelToolCalls: action.risk === "read",
    execute: async (args) => await this.serviceAppManager.invokeServiceAction(
      action.id,
      {
        caller,
        input: readInput(args),
      },
    ),
  });
}

function readInput(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Service Action tool input must be an object.");
  }
  return value as Record<string, unknown>;
}
