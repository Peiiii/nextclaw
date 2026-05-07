import type { Config } from "./schema.js";

type AgentProfile = Config["agents"]["list"][number];

type AgentRuntimeInput = {
  runtime?: string;
  runtimeConfig?: Record<string, unknown>;
  engine?: string;
  engineConfig?: Record<string, unknown>;
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export { normalizeOptionalString, toRecord };

function resolveAgentRuntimeInput(input: AgentRuntimeInput): string | null {
  return normalizeOptionalString(input.runtime) ?? normalizeOptionalString(input.engine);
}

function resolveAgentRuntimeConfigInput(input: AgentRuntimeInput): Record<string, unknown> | undefined {
  return toRecord(input.runtimeConfig) ?? toRecord(input.engineConfig);
}

export function buildAgentModelPatch(model?: string): Pick<AgentProfile, "model"> {
  const normalizedModel = normalizeOptionalString(model);
  return normalizedModel ? { model: normalizedModel } : {};
}

export function buildAgentRuntimePatch(input: AgentRuntimeInput): Pick<AgentProfile, "engine" | "engineConfig"> {
  const runtime = resolveAgentRuntimeInput(input);
  const runtimeConfig = resolveAgentRuntimeConfigInput(input);
  return {
    ...(runtime ? { engine: runtime } : {}),
    ...(runtimeConfig ? { engineConfig: runtimeConfig } : {})
  };
}

export function applyAgentProfileModelUpdate(profile: AgentProfile, value?: string): void {
  if (value === undefined) {
    return;
  }
  const normalized = normalizeOptionalString(value);
  if (normalized) {
    profile.model = normalized;
    return;
  }
  delete profile.model;
}

export function applyAgentProfileRuntimeUpdate(profile: AgentProfile, input: AgentRuntimeInput): void {
  if (input.runtime !== undefined || input.engine !== undefined) {
    const runtime = resolveAgentRuntimeInput(input);
    if (runtime) {
      profile.engine = runtime;
    } else {
      delete profile.engine;
    }
  }

  if (input.runtimeConfig !== undefined || input.engineConfig !== undefined) {
    const runtimeConfig = resolveAgentRuntimeConfigInput(input);
    if (runtimeConfig) {
      profile.engineConfig = runtimeConfig;
    } else {
      delete profile.engineConfig;
    }
  }
}
