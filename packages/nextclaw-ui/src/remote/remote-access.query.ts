import { fetchRemoteStatus } from '@/api/remote';
import type { RemoteAccessView } from '@/api/remote.types';
import { appQueryClient } from '@/app-query-client';

export const REMOTE_STATUS_QUERY_KEY = ['remote-status'] as const;

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
