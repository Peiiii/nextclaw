export const RUNTIME_DEFAULT_MODEL_VALUE = "__nextclaw_runtime_default__";

export type RuntimeModelSelectionMode =
  | "nextclaw"
  | "optional"
  | "runtime-default";

export function isRuntimeDefaultModelValue(value: unknown): boolean {
  return value === RUNTIME_DEFAULT_MODEL_VALUE;
}

export function normalizeRuntimeModelSelectionMode(
  value: unknown,
): RuntimeModelSelectionMode {
  if (value === "optional" || value === "runtime-default") {
    return value;
  }
  return "nextclaw";
}
