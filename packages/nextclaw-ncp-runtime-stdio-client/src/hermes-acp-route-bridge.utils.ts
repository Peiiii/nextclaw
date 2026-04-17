import { existsSync } from "node:fs";
import { basename, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import type { NcpProviderRuntimeRoute } from "@nextclaw/ncp";
import {
  buildRuntimeRouteBridgeEnv,
  type StdioRuntimeResolvedConfig,
} from "./stdio-runtime-config.utils.js";

const HERMES_ACP_BRIDGE_ENABLE_ENV = "NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE";
const HERMES_ACP_BRIDGE_DIR_ENV = "NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE_DIR";
const HERMES_ACP_PROBE_ROUTE: NcpProviderRuntimeRoute = {
  model: "nextclaw-hermes-acp-probe",
  apiBase: "http://127.0.0.1:1/v1",
  apiKey: "nextclaw-hermes-acp-probe-key",
  headers: {
    "x-nextclaw-narp-api-mode": "chat_completions",
  },
};

type StdioLaunchEnvParams = {
  config: StdioRuntimeResolvedConfig;
  providerRoute?: NcpProviderRuntimeRoute;
  baseEnv?: Record<string, string | undefined>;
  useProbeRoute?: boolean;
};

function normalizeCommandBasename(command: string): string {
  return basename(command).trim().toLowerCase();
}

function isPythonCommand(command: string): boolean {
  const normalized = normalizeCommandBasename(command);
  return normalized === "python" || normalized === "python3" || normalized.startsWith("python3.");
}

function targetsHermesAcpModule(args: string[]): boolean {
  for (let index = 0; index < args.length - 1; index += 1) {
    if (args[index] === "-m" && args[index + 1]?.trim().toLowerCase() === "acp_adapter.entry") {
      return true;
    }
  }
  return false;
}

export function isHermesAcpRuntimeConfig(config: Pick<StdioRuntimeResolvedConfig, "command" | "args">): boolean {
  const command = normalizeCommandBasename(config.command);
  if (command === "hermes-acp") {
    return true;
  }
  if (command === "hermes") {
    return config.args[0]?.trim().toLowerCase() === "acp";
  }
  if (isPythonCommand(config.command)) {
    return targetsHermesAcpModule(config.args);
  }
  return false;
}

function resolveHermesAcpBridgeDir(): string | null {
  const bridgeDir = fileURLToPath(new URL("./hermes-acp-route-bridge", import.meta.url));
  return existsSync(bridgeDir) ? bridgeDir : null;
}

function mergePathList(existingValue: string | undefined, injectedPath: string): string {
  const parts = (existingValue ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!parts.includes(injectedPath)) {
    parts.unshift(injectedPath);
  }
  return parts.join(delimiter);
}

export function buildStdioLaunchEnv(params: StdioLaunchEnvParams): Record<string, string> {
  const providerRoute =
    params.providerRoute ??
    (params.useProbeRoute && isHermesAcpRuntimeConfig(params.config)
      ? HERMES_ACP_PROBE_ROUTE
      : undefined);
  const baseEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.baseEnv ?? process.env)) {
    if (typeof value === "string") {
      baseEnv[key] = value;
    }
  }
  const env = {
    ...baseEnv,
    ...(params.config.env ?? {}),
    ...buildRuntimeRouteBridgeEnv({
      providerRoute,
    }),
  };

  if (!isHermesAcpRuntimeConfig(params.config)) {
    return env;
  }

  const bridgeDir = resolveHermesAcpBridgeDir();
  if (!bridgeDir) {
    return env;
  }

  return {
    ...env,
    [HERMES_ACP_BRIDGE_ENABLE_ENV]: "1",
    [HERMES_ACP_BRIDGE_DIR_ENV]: bridgeDir,
    PYTHONPATH: mergePathList(env.PYTHONPATH, bridgeDir),
  };
}
