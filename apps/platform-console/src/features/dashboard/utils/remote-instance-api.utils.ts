import { request, unwrap } from "@/api/client";
import type { ApiEnvelope } from "@/api/types";
import type {
  RemoteInstance,
  RemoteInstanceListPage,
  RemoteInstanceListQuery,
  RemoteInstanceOpenSession,
} from "@/features/dashboard/types/remote-instance.types";

function normalizeDevelopmentHostedUrl(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url);
    const isLoopback = (hostname: string) =>
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";
    if (!isLoopback(window.location.hostname) || !isLoopback(parsed.hostname))
      return url;
    parsed.protocol = window.location.protocol;
    parsed.host = window.location.host;
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function fetchRemoteInstancePage(
  token: string,
  query: RemoteInstanceListQuery,
): Promise<RemoteInstanceListPage> {
  const searchParams = new URLSearchParams({
    archiveStatus: query.archiveStatus,
    connectionStatus: query.connectionStatus,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.q) {
    searchParams.set("q", query.q);
  }
  const data = await request<ApiEnvelope<RemoteInstanceListPage>>(
    `/platform/remote/instances?${searchParams.toString()}`,
    {},
    token,
  );
  return unwrap(data);
}

export async function openRemoteInstanceAccess(
  token: string,
  instanceId: string,
): Promise<RemoteInstanceOpenSession> {
  const data = await request<ApiEnvelope<RemoteInstanceOpenSession>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/open`,
    { method: "POST" },
    token,
  );
  const session = unwrap(data);
  return {
    ...session,
    openUrl: normalizeDevelopmentHostedUrl(session.openUrl),
    fixedDomainOpenUrl: session.fixedDomainOpenUrl
      ? normalizeDevelopmentHostedUrl(session.fixedDomainOpenUrl)
      : null,
    systemDomainOpenUrl: session.systemDomainOpenUrl
      ? normalizeDevelopmentHostedUrl(session.systemDomainOpenUrl)
      : null,
    customDomainOpenUrl: session.customDomainOpenUrl
      ? normalizeDevelopmentHostedUrl(session.customDomainOpenUrl)
      : null,
  };
}

export async function updateRemoteInstanceDomain(
  token: string,
  instanceId: string,
  prefix: string,
): Promise<RemoteInstance> {
  const data = await request<ApiEnvelope<{ instance: RemoteInstance }>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/domain`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefix }),
    },
    token,
  );
  return unwrap(data).instance;
}

export async function releaseRemoteInstanceDomain(
  token: string,
  instanceId: string,
): Promise<RemoteInstance> {
  const data = await request<ApiEnvelope<{ instance: RemoteInstance }>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/domain`,
    { method: "DELETE" },
    token,
  );
  return unwrap(data).instance;
}
