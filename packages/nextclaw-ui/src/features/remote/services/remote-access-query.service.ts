import { fetchRemoteStatus } from '@/api/remote';
import type { RemoteAccessView } from '@/api/remote.types';
import { appQueryClient } from '@/app-query-client';

export const REMOTE_STATUS_QUERY_KEY = ['remote-status'] as const;
const DEFAULT_NEXTCLAW_WEB_BASE = 'https://platform.nextclaw.io';
const PREVIEW_NEXTCLAW_WEB_BASE = 'https://nextclaw-platform-console.pages.dev';

export const getRemoteStatusSnapshot = () => {
  return appQueryClient.getQueryData<RemoteAccessView>(REMOTE_STATUS_QUERY_KEY);
};

export const ensureRemoteStatus = async () => {
  return await appQueryClient.fetchQuery({
    queryKey: REMOTE_STATUS_QUERY_KEY,
    queryFn: fetchRemoteStatus,
    staleTime: 5000
  });
};

export const refreshRemoteStatus = async () => {
  await appQueryClient.invalidateQueries({ queryKey: REMOTE_STATUS_QUERY_KEY });
  return await ensureRemoteStatus();
};

export const resolveRemotePlatformApiBase = (status: RemoteAccessView | undefined, override?: string) => {
  const trimmedOverride = override?.trim();
  if (trimmedOverride) {
    return trimmedOverride;
  }
  const trimmedSettingsBase = status?.settings.platformApiBase?.trim();
  if (trimmedSettingsBase) {
    return trimmedSettingsBase;
  }
  return status?.account.apiBase?.trim() || undefined;
};

export const resolveRemotePlatformBase = (status: RemoteAccessView | undefined) => {
  return status?.platformBase?.trim() || status?.account.platformBase?.trim() || undefined;
};

function resolveWebBaseFromRawUrl(rawUrl: string | null | undefined): string | undefined {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (parsedUrl.hostname === 'platform.nextclaw.io' || parsedUrl.hostname === 'nextclaw-platform-console.pages.dev') {
    return parsedUrl.origin;
  }

  if (parsedUrl.hostname === 'ai-gateway-api.nextclaw.io') {
    return DEFAULT_NEXTCLAW_WEB_BASE;
  }

  if (parsedUrl.hostname.includes('nextclaw-provider-gateway-api') && parsedUrl.hostname.endsWith('.workers.dev')) {
    return PREVIEW_NEXTCLAW_WEB_BASE;
  }

  return undefined;
}

export const resolveRemoteWebBase = (status: RemoteAccessView | undefined) => {
  return (
    resolveWebBaseFromRawUrl(status?.account.apiBase) ||
    resolveWebBaseFromRawUrl(status?.settings.platformApiBase) ||
    resolveWebBaseFromRawUrl(status?.platformBase) ||
    resolveWebBaseFromRawUrl(status?.account.platformBase) ||
    undefined
  );
};
