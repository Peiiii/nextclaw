import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter } from "node:path";
import {
  resolveProviderRuntime,
  type Config,
  type Disposable,
} from "@nextclaw/core";
import type { NcpAgentRunInput, NcpProviderRuntimeRoute } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  HttpRuntimeConfigResolver,
  HttpRuntimeNcpAgentRuntime,
} from "@nextclaw/nextclaw-ncp-runtime-http-client";
import {
  probeStdioRuntime,
  StdioRuntimeConfigResolver,
  StdioRuntimeNcpAgentRuntime,
} from "@nextclaw/nextclaw-ncp-runtime-stdio-client";
import type {
  UiNcpRuntimeEntry,
  UiNcpRuntimeRegistry,
  UiNcpSessionTypeDescribeParams,
  UiNcpSessionTypeOption,
} from "./ui-ncp-runtime-registry.js";
import {
  NARP_HTTP_RUNTIME_KIND,
  NARP_STDIO_RUNTIME_KIND,
} from "./builtin-narp-runtime-types.js";

const NARP_API_MODE_HEADER = "x-nextclaw-narp-api-mode";

type SessionTypeDescriptor = Omit<UiNcpSessionTypeOption, "value" | "label">;

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function resolveRequestedModel(params: {
  input: NcpAgentRunInput;
  sessionMetadata: Record<string, unknown>;
  defaultModel?: string;
  configuredModel?: string;
}): string | undefined {
  const runMetadata = readRecord(params.input.metadata);
  return (
    readString(runMetadata?.preferred_model) ??
    readString(runMetadata?.preferredModel) ??
    readString(runMetadata?.model) ??
    readString(params.sessionMetadata.preferred_model) ??
    readString(params.sessionMetadata.preferredModel) ??
    readString(params.sessionMetadata.model) ??
    params.configuredModel ??
    params.defaultModel
  );
}

function resolveProviderApiMode(
  resolution: ReturnType<typeof resolveProviderRuntime>,
): "chat_completions" | "codex_responses" | "anthropic_messages" {
  const wireApi = resolution.provider?.wireApi?.trim().toLowerCase();
  if (wireApi === "responses") {
    return "codex_responses";
  }
  if (wireApi === "chat") {
    return "chat_completions";
  }
  const providerName = resolution.providerName?.trim().toLowerCase();
  const apiBase = resolution.apiBase?.trim().toLowerCase() ?? "";
  if (providerName === "anthropic" || apiBase.includes("anthropic.com")) {
    return "anthropic_messages";
  }
  return "chat_completions";
}

function buildProviderRoute(params: {
  config: Config;
  input: NcpAgentRunInput;
  sessionMetadata: Record<string, unknown>;
  defaultModel?: string;
  configuredModel?: string;
}): NcpProviderRuntimeRoute | undefined {
  const model = resolveRequestedModel(params);
  if (!model) {
    return undefined;
  }
  const resolution = resolveProviderRuntime(params.config, model);
  if (!resolution.provider) {
    return undefined;
  }
  return {
    model: resolution.providerLocalModel,
    apiKey: resolution.apiKey,
    apiBase: resolution.apiBase,
    headers: {
      ...(resolution.provider.extraHeaders ?? {}),
      [NARP_API_MODE_HEADER]: resolveProviderApiMode(resolution),
    },
  };
}

class BuiltinHttpRuntimeSessionTypeService {
  private readonly pendingDescribeByMode = new Map<
    "observation" | "probe",
    Promise<SessionTypeDescriptor>
  >();

  constructor(private readonly entry: UiNcpRuntimeEntry, private readonly defaultModel?: string) {}

  describe = async (
    describeParams?: UiNcpSessionTypeDescribeParams,
  ): Promise<SessionTypeDescriptor> => {
    const describeMode =
      describeParams?.describeMode === "probe" ? "probe" : "observation";
    const pending = this.pendingDescribeByMode.get(describeMode);
    if (pending) {
      return await pending;
    }
    const nextDescribe = this.describeInternal();
    this.pendingDescribeByMode.set(describeMode, nextDescribe);
    try {
      return await nextDescribe;
    } finally {
      this.pendingDescribeByMode.delete(describeMode);
    }
  };

  private describeInternal = async (): Promise<SessionTypeDescriptor> => {
    const resolver = new HttpRuntimeConfigResolver(this.entry.config ?? {});
    const config = resolver.resolve({
      defaultModel: this.defaultModel,
    });

    if (!config.baseUrl) {
      return {
        ready: false,
        reason: "base_url_missing",
        reasonMessage: "Configure the runtime entry baseUrl before starting an HTTP runtime session.",
        recommendedModel: config.recommendedModel ?? null,
        cta: {
          kind: "settings",
          label: "Configure HTTP Runtime",
        },
      };
    }

    const shouldProbe = (config.capabilityProbe ?? true) && Boolean(config.healthcheckUrl);
    if (!shouldProbe) {
      return {
        ready: true,
        reason: null,
        reasonMessage: null,
        recommendedModel: config.recommendedModel ?? null,
        ...(config.supportedModels ? { supportedModels: config.supportedModels } : {}),
        cta: null,
      };
    }

    const controller = new AbortController();
    const timeoutMs = config.healthcheckTimeoutMs ?? 3000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(config.healthcheckUrl ?? "", {
        method: "GET",
        headers: config.headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          ready: false,
          reason: "healthcheck_failed",
          reasonMessage: `HTTP runtime healthcheck returned HTTP ${response.status}.`,
          recommendedModel: config.recommendedModel ?? null,
          ...(config.supportedModels ? { supportedModels: config.supportedModels } : {}),
          cta: null,
        };
      }
      return {
        ready: true,
        reason: null,
        reasonMessage: null,
        recommendedModel: config.recommendedModel ?? null,
        ...(config.supportedModels ? { supportedModels: config.supportedModels } : {}),
        cta: null,
      };
    } catch (error) {
      return {
        ready: false,
        reason: "healthcheck_unreachable",
        reasonMessage:
          error instanceof Error
            ? error.message
            : "Failed to reach the configured HTTP runtime healthcheck.",
        recommendedModel: config.recommendedModel ?? null,
        ...(config.supportedModels ? { supportedModels: config.supportedModels } : {}),
        cta: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

class BuiltinStdioRuntimeSessionTypeService {
  private readonly pendingDescribeByMode = new Map<
    "observation" | "probe",
    Promise<SessionTypeDescriptor>
  >();

  constructor(private readonly entry: UiNcpRuntimeEntry) {}

  describe = async (
    describeParams?: UiNcpSessionTypeDescribeParams,
  ): Promise<SessionTypeDescriptor> => {
    const describeMode =
      describeParams?.describeMode === "probe" ? "probe" : "observation";
    const pending = this.pendingDescribeByMode.get(describeMode);
    if (pending) {
      return await pending;
    }
    const nextDescribe = this.describeInternal(describeMode);
    this.pendingDescribeByMode.set(describeMode, nextDescribe);
    try {
      return await nextDescribe;
    } finally {
      this.pendingDescribeByMode.delete(describeMode);
    }
  };

  private describeInternal = async (
    describeMode: "observation" | "probe",
  ): Promise<SessionTypeDescriptor> => {
    const resolver = new StdioRuntimeConfigResolver(this.entry.config ?? {});
    try {
      const config = resolver.resolve();
      const executablePath = await resolveExecutablePath(config.command);
      if (!executablePath) {
        return {
          ready: false,
          reason: "command_missing",
          reasonMessage: `Configured stdio command "${config.command}" is not available. Update the runtime entry command or install the required launcher first.`,
          cta: {
            kind: "settings",
            label: "Configure Stdio Runtime",
          },
        };
      }
      if (describeMode === "probe") {
        try {
          await probeStdioRuntime(config);
        } catch (error) {
          return {
            ready: false,
            reason: "probe_failed",
            reasonMessage:
              error instanceof Error
                ? error.message
                : "Configured stdio runtime could not complete the ACP probe.",
            cta: {
              kind: "settings",
              label: "Repair Stdio Runtime",
            },
          };
        }
      }
      return {
        ready: true,
        reason: null,
        reasonMessage: null,
        cta: null,
      };
    } catch (error) {
      return {
        ready: false,
        reason: "command_missing",
        reasonMessage:
          error instanceof Error
            ? error.message
            : "Configure a stdio command before starting this runtime.",
        cta: {
          kind: "settings",
          label: "Configure Stdio Runtime",
        },
      };
    }
  };
}

async function resolveExecutablePath(command: string): Promise<string | null> {
  if (command.includes("/") || command.includes("\\")) {
    return (await isExecutable(command)) ? command : null;
  }
  const searchPath = process.env.PATH ?? "";
  for (const directory of searchPath.split(delimiter)) {
    const trimmed = directory.trim();
    if (!trimmed) {
      continue;
    }
    const candidate = `${trimmed}/${command}`;
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export class BuiltinNarpRuntimeRegistrationService {
  constructor(private readonly getConfig: () => Config) {}

  registerInto = (runtimeRegistry: UiNcpRuntimeRegistry): Disposable[] => {
    return [
      runtimeRegistry.register({
        kind: NARP_HTTP_RUNTIME_KIND,
        label: "NARP HTTP",
        createRuntime: this.createUnavailableRuntime,
        createRuntimeForEntry: ({ entry, runtimeParams }) =>
          this.createHttpRuntime(entry, runtimeParams),
        describeSessionTypeForEntry: ({ entry, describeParams }) =>
          new BuiltinHttpRuntimeSessionTypeService(
            entry,
            this.getConfig().agents.defaults.model,
          ).describe(describeParams),
      }),
      runtimeRegistry.register({
        kind: NARP_STDIO_RUNTIME_KIND,
        label: "NARP Stdio",
        createRuntime: this.createUnavailableRuntime,
        createRuntimeForEntry: ({ entry, runtimeParams }) =>
          this.createStdioRuntime(entry, runtimeParams),
        describeSessionTypeForEntry: ({ entry, describeParams }) =>
          new BuiltinStdioRuntimeSessionTypeService(entry).describe(describeParams),
      }),
    ];
  };

  private createUnavailableRuntime = (): never => {
    throw new Error("[narp] runtime entry is required before creating this runtime");
  };

  private createHttpRuntime = (
    entry: UiNcpRuntimeEntry,
    runtimeParams: RuntimeFactoryParams,
  ): HttpRuntimeNcpAgentRuntime => {
    const config = readRecord(entry.config) ?? {};
    const resolver = new HttpRuntimeConfigResolver(config);
    const resolvedConfig = resolver.resolve({
      defaultModel: this.getConfig().agents.defaults.model,
    });
    return new HttpRuntimeNcpAgentRuntime({
      baseUrl: resolver.requireBaseUrl(),
      ...(resolvedConfig.basePath ? { basePath: resolvedConfig.basePath } : {}),
      ...(resolvedConfig.endpointId ? { endpointId: resolvedConfig.endpointId } : {}),
      ...(resolvedConfig.headers ? { headers: resolvedConfig.headers } : {}),
      stateManager: runtimeParams.stateManager,
      resolveTools: runtimeParams.resolveTools,
      resolveProviderRoute: (input) =>
        buildProviderRoute({
          config: this.getConfig(),
          input,
          sessionMetadata: runtimeParams.sessionMetadata,
          defaultModel: this.getConfig().agents.defaults.model,
          configuredModel: readString(config.model),
        }),
    });
  };

  private createStdioRuntime = (
    entry: UiNcpRuntimeEntry,
    runtimeParams: RuntimeFactoryParams,
  ): StdioRuntimeNcpAgentRuntime => {
    const config = readRecord(entry.config) ?? {};
    const resolver = new StdioRuntimeConfigResolver(config);
    return new StdioRuntimeNcpAgentRuntime({
      ...resolver.resolve(),
      sessionId: runtimeParams.sessionId,
      stateManager: runtimeParams.stateManager,
      resolveTools: runtimeParams.resolveTools,
      resolveProviderRoute: (input: NcpAgentRunInput) =>
        buildProviderRoute({
          config: this.getConfig(),
          input,
          sessionMetadata: runtimeParams.sessionMetadata,
          defaultModel: this.getConfig().agents.defaults.model,
          configuredModel: readString(config.model),
        }),
    });
  };
}
