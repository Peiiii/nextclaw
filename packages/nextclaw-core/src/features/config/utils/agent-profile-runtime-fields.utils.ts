import type { Config } from "@core/features/config/configs/config-schema.config.js";

type AgentProfile = Config["agents"]["list"][number];

type AgentRuntimeInput = {
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  engine?: string;
  engineConfig?: Record<string, unknown> | null;
};

export type AgentProfileAdvancedInput = {
  contextTokens?: number | null;
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

function normalizeOptionalInteger(value: number | null | undefined, minimum: number): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(minimum, Math.trunc(value));
}

export function buildAgentAdvancedPatch(input: AgentProfileAdvancedInput): Partial<AgentProfile> {
  const patch: Partial<AgentProfile> = {};
  const contextTokens = normalizeOptionalInteger(input.contextTokens, 1000);
  if (typeof contextTokens === "number") {
    patch.contextTokens = contextTokens;
  }
  return patch;
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

export function hasAgentProfileAdvancedInput(input: AgentProfileAdvancedInput): boolean {
  return input.contextTokens !== undefined;
}
