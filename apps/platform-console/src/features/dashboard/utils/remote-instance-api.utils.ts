import { request, unwrap } from '@/api/client';
import type { ApiEnvelope } from '@/api/types';
import type {
  RemoteInstanceListPage,
  RemoteInstanceListQuery
} from '@/features/dashboard/types/remote-instance.types';

export async function fetchRemoteInstances(
  token: string,
  query: RemoteInstanceListQuery
): Promise<RemoteInstanceListPage> {
  const searchParams = new URLSearchParams({
    archiveStatus: query.archiveStatus,
    connectionStatus: query.connectionStatus,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection
  });
  if (query.q) {
    searchParams.set('q', query.q);
  }
  const data = await request<ApiEnvelope<RemoteInstanceListPage>>(
    `/platform/remote/instances?${searchParams.toString()}`,
    {},
    token
  );
  return unwrap(data);
}
