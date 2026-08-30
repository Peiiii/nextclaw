import { normalizeToolParams } from "@nextclaw/core";
import type { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

/** Agent control-plane access for non-secret Service App AI slot bindings. */
export class ServiceAppAiCapabilityToolProvider implements ToolProvider {
  constructor(private readonly manager: ServiceAppManager) {}

  provide = (_request: AgentRunRequest): readonly NcpTool[] => [
    this.readTool("app_ai_capabilities_inspect", "inspectServiceAppAiCapabilities"),
    this.readTool("app_ai_capabilities_verify", "verifyServiceAppAiCapabilities"),
    this.bindModelTool(),
    this.bindAgentTool(),
    this.unbindTool(),
  ];

  private readTool = (
    name: string,
    method: "inspectServiceAppAiCapabilities" | "verifyServiceAppAiCapabilities",
  ): NcpTool => ({
    name,
    description: "Inspect non-secret Service App model and Agent slot readiness.",
    parameters: appSchema(),
    execute: async (args) => JSON.stringify(await this.manager[method](readAppId(args)), null, 2),
  });

  private bindModelTool = (): NcpTool => ({
    name: "app_ai_model_slot_bind",
    description: "Bind a declared Service App model slot to a configured model after explicit user approval.",
    parameters: mutationSchema({ modelId: { type: "string" } }),
    execute: async (args) => await this.mutate(args, "model-bind", (input) =>
      this.manager.bindServiceAppModelSlot(input.appId, input.slotId, readString(input.params.modelId, "modelId"))),
  });

  private bindAgentTool = (): NcpTool => ({
    name: "app_ai_agent_slot_bind",
    description: "Bind a declared Service App Agent slot to an existing Agent after explicit user approval.",
    parameters: mutationSchema({ agentId: { type: "string" } }),
    execute: async (args) => await this.mutate(args, "agent-bind", (input) =>
      this.manager.bindServiceAppAgentSlot(input.appId, input.slotId, readString(input.params.agentId, "agentId"))),
  });

  private unbindTool = (): NcpTool => ({
    name: "app_ai_slot_unbind",
    description: "Remove a Service App model or Agent slot binding after explicit user approval.",
    parameters: mutationSchema({ kind: { type: "string", enum: ["model", "agent"] } }),
    execute: async (args) => await this.mutate(args, "unbind", (input) => {
      const kind = input.params.kind;
      if (kind !== "model" && kind !== "agent") throw new Error("kind must be model or agent.");
      return this.manager.unbindServiceAppAiSlot(input.appId, kind, input.slotId);
    }),
  });

  private mutate = async (
    args: unknown,
    action: string,
    execute: (input: { appId: string; slotId: string; params: Record<string, unknown> }) => Promise<unknown>,
  ): Promise<string> => {
    const params = normalizeToolParams(args);
    const appId = readAppId(params);
    const slotId = readString(params.slotId, "slotId");
    if (params.confirm !== true) return JSON.stringify({ status: "requires_user_authorization", action, appId }, null, 2);
    return JSON.stringify(await execute({ appId, slotId, params }), null, 2);
  };
}

function appSchema(): NcpTool["parameters"] {
  return { type: "object", properties: { appId: { type: "string" } }, required: ["appId"], additionalProperties: false };
}

function mutationSchema(extra: Record<string, unknown>): NcpTool["parameters"] {
  return {
    type: "object",
    properties: { appId: { type: "string" }, slotId: { type: "string" }, confirm: { type: "boolean" }, ...extra },
    required: ["appId", "slotId"],
    additionalProperties: false,
  };
}

function readAppId(value: unknown): string {
  return readString(normalizeToolParams(value).appId, "appId");
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  return value.trim();
}
