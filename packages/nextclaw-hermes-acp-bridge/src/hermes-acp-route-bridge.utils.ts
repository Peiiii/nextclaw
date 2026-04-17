import { existsSync } from "node:fs";
import { basename, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const HERMES_ACP_BRIDGE_ENABLE_ENV = "NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE";
const HERMES_ACP_BRIDGE_DIR_ENV = "NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE_DIR";
const HERMES_ACP_PROBE_ROUTE_ENV = {
  NEXTCLAW_MODEL: "nextclaw-hermes-acp-probe",
  NEXTCLAW_API_BASE: "http://127.0.0.1:1/v1",
  NEXTCLAW_API_KEY: "nextclaw-hermes-acp-probe-key",
  NEXTCLAW_HEADERS_JSON: JSON.stringify({
    "x-nextclaw-narp-api-mode": "chat_completions",
  }),
} as const;

type HermesAcpLaunchTarget = {
  command: string;
  args: string[];
};

type HermesAcpBridgeLaunchEnvParams = HermesAcpLaunchTarget & {
  baseEnv?: Record<string, string | undefined>;
  useProbeRoute?: boolean;
};

function normalizeCommandBasename(command: string): string {
  return basename(command).trim().toLowerCase();
}

function normalizeStringEnv(source: Record<string, string | undefined>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      output[key] = value;
    }
  }
  return output;
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

export function isHermesAcpRuntimeConfig(config: HermesAcpLaunchTarget): boolean {
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

export function buildHermesAcpBridgeLaunchEnv(
  params: HermesAcpBridgeLaunchEnvParams,
): Record<string, string> {
  const env = normalizeStringEnv(params.baseEnv ?? process.env);
  if (!isHermesAcpRuntimeConfig(params)) {
    return env;
  }
  const bridgeDir = resolveHermesAcpBridgeDir();
  if (!bridgeDir) {
    return env;
  }
  return {
    ...env,
    ...(params.useProbeRoute ? HERMES_ACP_PROBE_ROUTE_ENV : {}),
    [HERMES_ACP_BRIDGE_ENABLE_ENV]: "1",
    [HERMES_ACP_BRIDGE_DIR_ENV]: bridgeDir,
    PYTHONPATH: mergePathList(env.PYTHONPATH, bridgeDir),
  };
}
