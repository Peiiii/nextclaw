import type { OpenClawPluginApi } from "../plugins/types.js";

export type { OpenClawPluginApi } from "../plugins/types.js";

export type OpenClawPluginConfigSchema = {
  type: "object";
  additionalProperties: boolean;
  properties: Record<string, unknown>;
};

export function emptyPluginConfigSchema(): OpenClawPluginConfigSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: {}
  };
}

export function buildChannelConfigSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return schema;
}

export function buildOauthProviderAuthResult(params: {
  providerId: string;
  defaultModel?: string;
  access: string;
  refresh?: string;
  expires?: string | number;
  email?: string;
  credentialExtra?: Record<string, unknown>;
  notes?: string[];
}): {
  profiles: Array<{ profileId: string; credential: Record<string, unknown> }>;
  defaultModel?: string;
  notes?: string[];
} {
  const profileId = params.email ? `${params.providerId}:${params.email}` : params.providerId;
  return {
    profiles: [
      {
        profileId,
        credential: {
          providerId: params.providerId,
          accessToken: params.access,
          refreshToken: params.refresh,
          expiresAt: params.expires,
          email: params.email,
          extra: params.credentialExtra ?? {}
        }
      }
    ],
    defaultModel: params.defaultModel,
    notes: params.notes
  };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export function normalizePluginHttpPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const DEFAULT_ACCOUNT_ID = "default";

export function normalizeAccountId(accountId?: string | null): string {
  const trimmed = accountId?.trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

// Re-exporting this marker keeps plugins that only import types from failing at runtime.
export const __nextclawPluginSdkCompat = true;

// The shim intentionally keeps runtime helpers minimal in this phase.
// Plugins requiring advanced SDK helpers will fail at registration and surface diagnostics.
export type _CompatOnly = OpenClawPluginApi;
