function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isValidExternalModelProvider(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

export function resolveExternalModelProvider(params: {
  explicitModelProvider?: unknown;
  providerName?: string | null;
  providerDisplayName?: string | null;
  runtimeEntryId: string;
}): string {
  const {
    explicitModelProvider: rawExplicitModelProvider,
    providerName: rawProviderName,
    providerDisplayName: rawProviderDisplayName,
    runtimeEntryId,
  } = params;
  const explicitModelProvider = readOptionalString(rawExplicitModelProvider);
  if (explicitModelProvider) {
    return explicitModelProvider;
  }

  const providerName = readOptionalString(rawProviderName);
  if (providerName) {
    return providerName;
  }

  const providerDisplayName = readOptionalString(rawProviderDisplayName);
  if (providerDisplayName && isValidExternalModelProvider(providerDisplayName)) {
    return providerDisplayName;
  }

  throw new Error(
    `[codex] custom provider "${providerName ?? "unknown"}" requires an external model provider id. ` +
      `Set agents.runtimes.entries.${runtimeEntryId}.config.modelProvider or use a provider display name with only letters, numbers, ".", "_" or "-".`,
  );
}

export function buildUserFacingModelRoute(params: {
  externalModelProvider: string;
  providerLocalModel: string;
  resolvedModel: string;
}): string {
  const providerLocalModel = params.providerLocalModel.trim();
  if (!providerLocalModel) {
    return params.resolvedModel.trim();
  }
  return `${params.externalModelProvider}/${providerLocalModel}`;
}

export function buildCodexBridgeModelProviderId(
  externalModelProvider: string,
): string {
  const normalized = externalModelProvider.trim();
  if (!normalized) {
    return "nextclaw-codex-bridge";
  }
  return `nextclaw-codex-bridge-${normalized}`;
}
