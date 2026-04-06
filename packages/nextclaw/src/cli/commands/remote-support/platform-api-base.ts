const DEFAULT_PLATFORM_API_BASE = "https://ai-gateway-api.nextclaw.io/v1";
const INVALID_PLATFORM_HINT =
  `Use ${DEFAULT_PLATFORM_API_BASE} or the platform root URL without a trailing path.`;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeExplicitApiBase(rawApiBase: string): string {
  const trimmed = trimTrailingSlash(rawApiBase.trim());
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/v1?$/i, "");
}

export function resolvePlatformApiBase(params: {
  explicitApiBase?: string | null;
  configuredApiBase?: string | null;
  fallbackApiBase?: string;
  requireConfigured?: boolean;
}): {
  platformBase: string;
  v1Base: string;
  inputApiBase: string;
} {
  const explicitApiBase = typeof params.explicitApiBase === "string" ? params.explicitApiBase.trim() : "";
  const configuredApiBase = typeof params.configuredApiBase === "string" ? params.configuredApiBase.trim() : "";
  const fallbackApiBase = params.fallbackApiBase ?? DEFAULT_PLATFORM_API_BASE;
  const inputApiBase = explicitApiBase || configuredApiBase || (params.requireConfigured ? "" : fallbackApiBase);
  if (!inputApiBase) {
    throw new Error("Platform API base is missing. Pass --api-base or run nextclaw login.");
  }

  const platformBase = normalizeExplicitApiBase(inputApiBase);
  if (!platformBase) {
    throw new Error(`Invalid --api-base "${inputApiBase}". ${INVALID_PLATFORM_HINT}`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(platformBase);
  } catch {
    throw new Error(`Invalid --api-base "${inputApiBase}". ${INVALID_PLATFORM_HINT}`);
  }

  if (parsedUrl.pathname !== "" && parsedUrl.pathname !== "/") {
    throw new Error(`Invalid --api-base "${inputApiBase}". ${INVALID_PLATFORM_HINT}`);
  }

  const normalizedPlatformBase = trimTrailingSlash(parsedUrl.toString());
  return {
    platformBase: normalizedPlatformBase,
    v1Base: `${normalizedPlatformBase}/v1`,
    inputApiBase
  };
}

export function buildPlatformApiBaseErrorMessage(inputApiBase: string, rawMessage: string): string {
  if (
    rawMessage.includes("Remote session cookie missing") ||
    rawMessage.includes("endpoint not found") ||
    rawMessage.includes("NOT_FOUND")
  ) {
    return `Invalid --api-base "${inputApiBase}". ${INVALID_PLATFORM_HINT}`;
  }
  return rawMessage;
}
