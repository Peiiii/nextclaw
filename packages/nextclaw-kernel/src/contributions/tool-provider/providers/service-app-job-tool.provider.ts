import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import type { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

type AgentJobCaller = { surface: "agent"; id: string };

/** Agent access is limited to Jobs created by the same Agent identity. */
export class ServiceAppJobToolProvider implements ToolProvider {
  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly serviceAppManager: ServiceAppManager,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await this.runContextService.resolve(request);
    const caller = { surface: "agent", id: toolRunContext.agentId } as const;
    return [
      this.listTool(caller),
      this.inspectTool(caller),
      this.watchTool(caller),
      this.cancelTool(caller),
    ];
  };

  private listTool = (caller: AgentJobCaller): NcpTool => ({
    name: "app_jobs_list",
    description: "List this Agent's durable Jobs for an installed App instance.",
    parameters: appIdSchema(),
    execute: async (args) => JSON.stringify(
      await this.serviceAppManager.listServiceAppJobs(readId(args, "appId"), { caller }),
      null,
      2,
    ),
  });

  private inspectTool = (caller: AgentJobCaller): NcpTool => ({
    name: "app_job_inspect",
    description: "Inspect one of this Agent's durable App Jobs.",
    parameters: jobSchema(),
    execute: async (args) => JSON.stringify(
      await this.serviceAppManager.getServiceAppJob(
        readId(args, "appId"), readId(args, "jobId"), { caller },
      ),
      null,
      2,
    ),
  });

  private watchTool = (caller: AgentJobCaller): NcpTool => ({
    name: "app_job_watch",
    description: "Replay retained progress and stream output for this Agent's App Job after an optional event sequence cursor. Watching never cancels the Job.",
    parameters: watchSchema(),
    execute: async (args) => JSON.stringify(
      await this.serviceAppManager.watchServiceAppJob(
        readId(args, "appId"),
        readId(args, "jobId"),
        readAfterSequence(args),
        { caller },
      ),
      null,
      2,
    ),
  });

  private cancelTool = (caller: AgentJobCaller): NcpTool => ({
    name: "app_job_cancel",
    description: "Request cancellation for this Agent's App Job. It remains cancel-requested until the runtime reports a real terminal result.",
    parameters: jobSchema(),
    execute: async (args) => JSON.stringify(
      await this.serviceAppManager.cancelServiceAppJob(
        readId(args, "appId"), readId(args, "jobId"), { caller },
      ),
      null,
      2,
    ),
  });
}

function appIdSchema(): NcpTool["parameters"] {
  return {
    type: "object",
    properties: { appId: { type: "string", description: "Installed App id." } },
    required: ["appId"],
    additionalProperties: false,
  };
}

function jobSchema(): NcpTool["parameters"] {
  return {
    type: "object",
    properties: {
      appId: { type: "string", description: "Installed App id." },
      jobId: { type: "string", description: "Durable Job id." },
    },
    required: ["appId", "jobId"],
    additionalProperties: false,
  };
}

function watchSchema(): NcpTool["parameters"] {
  return {
    type: "object",
    properties: {
      appId: { type: "string", description: "Installed App id." },
      jobId: { type: "string", description: "Durable Job id." },
      afterSequence: { type: "number", minimum: 0 },
    },
    required: ["appId", "jobId"],
    additionalProperties: false,
  };
}

function readId(args: unknown, key: "appId" | "jobId"): string {
  const value = args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>)[key]
    : undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

function readAfterSequence(args: unknown): number | undefined {
  const value = args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>).afterSequence
    : undefined;
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("afterSequence must be a non-negative integer.");
  }
  return value;
}
