import type { OpenAITool, NcpProviderRuntimeRoute } from "@nextclaw/ncp";

export const NARP_STDIO_PROMPT_META_KEY = "nextclaw_narp";
const DEFAULT_STARTUP_TIMEOUT_MS = 10_000;
const DEFAULT_PROBE_TIMEOUT_MS = 3_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_RUNTIME_ROUTE_BRIDGE_FIELDS = {
  model: "NEXTCLAW_MODEL",
  apiBase: "NEXTCLAW_API_BASE",
  apiKey: "NEXTCLAW_API_KEY",
  headers: "NEXTCLAW_HEADERS_JSON",
} as const;

export type StdioRuntimeEnv = Record<string, string>;
export type StdioRuntimeWireDialect = "acp";
export type StdioRuntimeProcessScope = "per-session";

export type NarpStdioPromptMeta = {
  correlationId?: string;
  providerRoute?: NcpProviderRuntimeRoute;
  sessionMetadata?: Record<string, unknown>;
  tools?: ReadonlyArray<OpenAITool>;
};

export type StdioRuntimeResolvedConfig = {
  wireDialect: StdioRuntimeWireDialect;
  processScope: StdioRuntimeProcessScope;
  command: string;
  args: string[];
  cwd?: string;
  env?: StdioRuntimeEnv;
  startupTimeoutMs: number;
  probeTimeoutMs: number;
  requestTimeoutMs: number;
};

export function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readPositiveInteger(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : undefined;
}

export function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const output: string[] = [];
  for (const entry of value) {
    const normalized = readString(entry);
    if (!normalized) {
      continue;
    }
    output.push(normalized);
  }
  return output.length > 0 ? output : undefined;
}

export function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const output: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const normalizedValue = readString(entryValue);
    if (!normalizedValue) {
      continue;
    }
    output[entryKey] = normalizedValue;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export class StdioRuntimeConfigResolver {
  constructor(private readonly source: Record<string, unknown> = {}) {}

  resolve = (): StdioRuntimeResolvedConfig => {
    const wireDialect = this.resolveWireDialect();
    const processScope = this.resolveProcessScope();
    const command =
      readString(this.source.command) ??
      readString(process.env.NEXTCLAW_NARP_STDIO_COMMAND);
    if (!command) {
      throw new Error("[narp-stdio] missing stdio command");
    }

    return {
      wireDialect,
      processScope,
      command,
      args:
        readStringArray(this.source.args) ??
        readStringArray(parseJsonArray(process.env.NEXTCLAW_NARP_STDIO_ARGS)) ??
        [],
      ...(readString(this.source.cwd) ?? readString(process.env.NEXTCLAW_NARP_STDIO_CWD)
        ? {
            cwd:
              readString(this.source.cwd) ??
              readString(process.env.NEXTCLAW_NARP_STDIO_CWD),
          }
        : {}),
      ...(readStringRecord(this.source.env) ?? readStringRecord(parseJsonObject(process.env.NEXTCLAW_NARP_STDIO_ENV))
        ? {
            env:
              readStringRecord(this.source.env) ??
              readStringRecord(parseJsonObject(process.env.NEXTCLAW_NARP_STDIO_ENV)),
          }
        : {}),
      startupTimeoutMs:
        readPositiveInteger(this.source.startupTimeoutMs) ??
        readPositiveInteger(process.env.NEXTCLAW_NARP_STDIO_STARTUP_TIMEOUT_MS) ??
        DEFAULT_STARTUP_TIMEOUT_MS,
      probeTimeoutMs:
        readPositiveInteger(this.source.probeTimeoutMs) ??
        DEFAULT_PROBE_TIMEOUT_MS,
      requestTimeoutMs:
        readPositiveInteger(this.source.requestTimeoutMs) ??
        DEFAULT_REQUEST_TIMEOUT_MS,
    };
  };

  private resolveWireDialect = (): StdioRuntimeWireDialect => {
    const wireDialect = readString(this.source.wireDialect) ?? "acp";
    if (wireDialect !== "acp") {
      throw new Error(`[narp-stdio] unsupported wireDialect "${wireDialect}"`);
    }
    return "acp";
  };

  private resolveProcessScope = (): StdioRuntimeProcessScope => {
    const processScope = readString(this.source.processScope) ?? "per-session";
    if (processScope !== "per-session") {
      throw new Error(`[narp-stdio] unsupported processScope "${processScope}"`);
    }
    return "per-session";
  };
}

export function buildRuntimeRouteBridgeEnv(params: {
  providerRoute?: NcpProviderRuntimeRoute;
}): Record<string, string> {
  const { providerRoute } = params;
  if (!providerRoute) {
    return {};
  }
  return {
    [DEFAULT_RUNTIME_ROUTE_BRIDGE_FIELDS.model]: providerRoute.model,
    [DEFAULT_RUNTIME_ROUTE_BRIDGE_FIELDS.apiBase]: providerRoute.apiBase ?? "",
    [DEFAULT_RUNTIME_ROUTE_BRIDGE_FIELDS.apiKey]: providerRoute.apiKey ?? "",
    [DEFAULT_RUNTIME_ROUTE_BRIDGE_FIELDS.headers]: JSON.stringify(providerRoute.headers ?? {}),
  };
}

export function buildStdioRuntimeLaunchEnv(params: {
  baseEnv?: Record<string, string | undefined>;
  configEnv?: StdioRuntimeEnv;
  providerRoute?: NcpProviderRuntimeRoute;
}): Record<string, string> {
  const baseEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.baseEnv ?? process.env)) {
    if (typeof value === "string") {
      baseEnv[key] = value;
    }
  }
  return {
    ...baseEnv,
    ...(params.configEnv ?? {}),
    ...buildRuntimeRouteBridgeEnv({
      providerRoute: params.providerRoute,
    }),
  };
}

function parseJsonArray(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseJsonObject(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
