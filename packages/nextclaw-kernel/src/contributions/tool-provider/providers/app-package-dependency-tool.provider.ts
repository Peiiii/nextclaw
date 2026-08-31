import { normalizeToolParams } from "@nextclaw/core";
import type { AppPackageManager } from "@kernel/managers/app-package.manager.js";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

const MUTATION_CONFIRMATION = {
  type: "object",
  properties: {
    appId: { type: "string", description: "Installed App id." },
    confirm: {
      type: "boolean",
      description:
        "Set true only after the user approves this local configuration change.",
    },
  },
  required: ["appId"],
  additionalProperties: false,
} as const;

export class AppPackageDependencyToolProvider implements ToolProvider {
  constructor(private readonly manager: AppPackageManager) {}

  provide = (_request: AgentRunRequest): readonly NcpTool[] => [
    this.inspectTool(),
    this.verifyTool(),
    this.setupTool(),
    this.bindTool(),
    this.unbindTool(),
    this.inspectSecretsTool(),
    this.verifySecretsTool(),
    this.bindSecretTool(),
    this.unbindSecretTool(),
  ];

  private inspectTool = (): NcpTool => ({
    name: "app_dependencies_inspect",
    description:
      "Inspect an installed App's declared dependencies, compatible trusted Providers, and non-sensitive bindings.",
    parameters: {
      type: "object",
      properties: { appId: { type: "string" } },
      required: ["appId"],
      additionalProperties: false,
    },
    execute: async (args) =>
      JSON.stringify(
        await this.manager.inspectDependencies(readAppId(args)),
        null,
        2,
      ),
  });

  private verifyTool = (): NcpTool => ({
    name: "app_dependencies_verify",
    description:
      "Verify whether an installed App's current capability and resource dependencies are satisfied.",
    parameters: {
      type: "object",
      properties: { appId: { type: "string" } },
      required: ["appId"],
      additionalProperties: false,
    },
    execute: async (args) =>
      JSON.stringify(
        await this.manager.verifyDependencies(readAppId(args)),
        null,
        2,
      ),
  });

  private setupTool = (): NcpTool => ({
    name: "app_dependencies_setup",
    description:
      "Set up dependency bindings only when each requirement has exactly one compatible trusted Provider. Run this only after the user has explicitly approved the local configuration change.",
    parameters: MUTATION_CONFIRMATION,
    execute: async (args) =>
      await this.executeWithConfirmation(args, "setup", (appId) =>
        this.manager.setupDependencies(appId),
      ),
  });

  private bindTool = (): NcpTool => ({
    name: "app_dependency_bind",
    description:
      "Bind one declared dependency to an installed trusted Provider. Run this only after the user has explicitly approved the local configuration change.",
    parameters: {
      type: "object",
      properties: {
        appId: { type: "string" },
        componentId: { type: "string" },
        requirementKind: { type: "string", enum: ["capability", "resource"] },
        requirementId: { type: "string" },
        providerId: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: [
        "appId",
        "componentId",
        "requirementKind",
        "requirementId",
        "providerId",
      ],
      additionalProperties: false,
    },
    execute: async (args) => {
      const input = readBinding(args);
      if (!readConfirmation(args))
        return confirmationResult("bind", input.appId);
      return JSON.stringify(
        await this.manager.bindDependency(input.appId, input),
        null,
        2,
      );
    },
  });

  private unbindTool = (): NcpTool => ({
    name: "app_dependency_unbind",
    description:
      "Remove one local dependency binding. Run this only after the user has explicitly approved the local configuration change.",
    parameters: {
      type: "object",
      properties: {
        appId: { type: "string" },
        componentId: { type: "string" },
        requirementKind: { type: "string", enum: ["capability", "resource"] },
        requirementId: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["appId", "componentId", "requirementKind", "requirementId"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const input = readUnbind(args);
      if (!readConfirmation(args))
        return confirmationResult("unbind", input.appId);
      return JSON.stringify(
        await this.manager.unbindDependency(input.appId, input),
        null,
        2,
      );
    },
  });

  private inspectSecretsTool = (): NcpTool => ({
    name: "app_secrets_inspect",
    description:
      "Inspect an installed App's declared Secret slots and non-sensitive SecretRef bindings. Never returns Secret values.",
    parameters: {
      type: "object",
      properties: { appId: { type: "string" } },
      required: ["appId"],
      additionalProperties: false,
    },
    execute: async (args) => JSON.stringify(
      await this.manager.inspectSecrets(readAppId(args)),
      null,
      2,
    ),
  });

  private verifySecretsTool = (): NcpTool => ({
    name: "app_secrets_verify",
    description:
      "Resolve an installed App's SecretRef bindings and return only readiness plus SECRET_* error codes, never Secret values.",
    parameters: {
      type: "object",
      properties: { appId: { type: "string" } },
      required: ["appId"],
      additionalProperties: false,
    },
    execute: async (args) => JSON.stringify(
      await this.manager.verifySecrets(readAppId(args)),
      null,
      2,
    ),
  });

  private bindSecretTool = (): NcpTool => ({
    name: "app_secret_bind",
    description:
      "Bind one declared App Secret slot to a configured provider. The tool stores only a SecretRef and requires explicit user approval before mutation.",
    parameters: {
      type: "object",
      properties: {
        appId: { type: "string" },
        slotId: { type: "string" },
        source: { type: "string", enum: ["env", "file", "exec"] },
        provider: { type: "string" },
        id: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["appId", "slotId", "source", "id"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const input = readSecretBinding(args);
      if (!readConfirmation(args)) return confirmationResult("secret-bind", input.appId);
      return JSON.stringify(await this.manager.bindSecret(input.appId, {
        slotId: input.slotId,
        binding: {
          source: input.source,
          provider: input.provider,
          id: input.id,
        },
      }), null, 2);
    },
  });

  private unbindSecretTool = (): NcpTool => ({
    name: "app_secret_unbind",
    description:
      "Remove one App SecretRef binding. This immediately removes the active Secret permission and requires explicit user approval.",
    parameters: {
      type: "object",
      properties: {
        appId: { type: "string" },
        slotId: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["appId", "slotId"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const params = normalizeToolParams(args);
      const appId = readAppId(params);
      const slotId = readString(params.slotId, "slotId");
      if (!readConfirmation(params)) return confirmationResult("secret-unbind", appId);
      return JSON.stringify(await this.manager.unbindSecret(appId, slotId), null, 2);
    },
  });

  private executeWithConfirmation = async (
    args: unknown,
    action: "setup",
    execute: (appId: string) => Promise<unknown>,
  ): Promise<string> => {
    const params = normalizeToolParams(args);
    const appId = readAppId(params);
    if (!readConfirmation(params)) return confirmationResult(action, appId);
    return JSON.stringify(await execute(appId), null, 2);
  };
}

function readAppId(value: unknown): string {
  const params = normalizeToolParams(value);
  if (typeof params.appId !== "string" || !params.appId.trim())
    throw new Error("appId must be a non-empty string.");
  return params.appId.trim();
}

function readConfirmation(value: unknown): boolean {
  const params = normalizeToolParams(value);
  return params.confirm === true;
}

function readBinding(value: unknown): {
  appId: string;
  componentId: string;
  requirementKind: "capability" | "resource";
  requirementId: string;
  providerId: string;
  confirm?: boolean;
} {
  const params = normalizeToolParams(value);
  const appId = readAppId(params);
  const componentId = readString(params.componentId, "componentId");
  const requirementId = readString(params.requirementId, "requirementId");
  const providerId = readString(params.providerId, "providerId");
  if (
    params.requirementKind !== "capability" &&
    params.requirementKind !== "resource"
  )
    throw new Error("requirementKind must be capability or resource.");
  return {
    appId,
    componentId,
    requirementKind: params.requirementKind,
    requirementId,
    providerId,
    confirm: params.confirm === true,
  };
}

function readUnbind(value: unknown): {
  appId: string;
  componentId: string;
  requirementKind: "capability" | "resource";
  requirementId: string;
  confirm?: boolean;
} {
  const params = normalizeToolParams(value);
  const binding = readBinding({ ...params, providerId: "unused" });
  return {
    appId: binding.appId,
    componentId: binding.componentId,
    requirementKind: binding.requirementKind,
    requirementId: binding.requirementId,
    confirm: binding.confirm,
  };
}

function readSecretBinding(value: unknown): {
  appId: string;
  slotId: string;
  source: "env" | "file" | "exec";
  provider?: string;
  id: string;
} {
  const params = normalizeToolParams(value);
  if (params.source !== "env" && params.source !== "file" && params.source !== "exec") {
    throw new Error("source must be env, file, or exec.");
  }
  return {
    appId: readAppId(params),
    slotId: readString(params.slotId, "slotId"),
    source: params.source,
    provider: params.provider === undefined ? undefined : readString(params.provider, "provider"),
    id: readString(params.id, "id"),
  };
}

function readString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function confirmationResult(action: string, appId: string): string {
  return JSON.stringify(
    {
      status: "requires_user_authorization",
      action,
      appId,
      message:
        "This changes local dependency configuration. Confirm that the user has approved it, then retry with confirm=true.",
    },
    null,
    2,
  );
}
