const DEFAULT_PLATFORM_API_BASE = "https://ai-gateway-api.nextclaw.io/v1";
const DOMESTIC_PLATFORM_API_BASE = "https://api.nextclaw.net/v1";
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
  platformBaseCandidates: string[];
} {
  const {
    explicitApiBase: explicitApiBaseInput,
    configuredApiBase: configuredApiBaseInput,
    fallbackApiBase,
    requireConfigured,
  } = params;
  const explicitApiBase = typeof explicitApiBaseInput === "string" ? explicitApiBaseInput.trim() : "";
  const configuredApiBase = typeof configuredApiBaseInput === "string" ? configuredApiBaseInput.trim() : "";
  const inputApiBase = explicitApiBase || configuredApiBase || (requireConfigured ? "" : (fallbackApiBase ?? DEFAULT_PLATFORM_API_BASE));
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
  const normalizedDomesticBase = trimTrailingSlash(
    normalizeExplicitApiBase(DOMESTIC_PLATFORM_API_BASE),
  );
  const candidates = [normalizedPlatformBase];
  if (
    normalizedDomesticBase &&
    normalizedDomesticBase !== normalizedPlatformBase
  ) {
    // 官方域名直连失败时，自动回退到国内可访问的备用地址。
    candidates.push(normalizedDomesticBase);
  }
  return {
    platformBase: normalizedPlatformBase,
    v1Base: `${normalizedPlatformBase}/v1`,
    inputApiBase,
    platformBaseCandidates: [...new Set(candidates)],
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
