function normalizeModel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveSubagentModel(params: {
  spawnModel?: unknown;
  sessionModel?: unknown;
  runtimeDefaultModel?: unknown;
  providerDefaultModel?: unknown;
}): string {
  return (
    normalizeModel(params.spawnModel) ??
    normalizeModel(params.sessionModel) ??
    normalizeModel(params.runtimeDefaultModel) ??
    normalizeModel(params.providerDefaultModel) ??
    ""
  );
}
