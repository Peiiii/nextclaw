export type HostBoundRemoteAccessSession = {
  id: string;
};

export function resolveHostBoundRemoteAccessSession<T extends HostBoundRemoteAccessSession>(params: {
  hostSessionId: string | null;
  cookieSession: T | null;
}): T | null {
  const { hostSessionId, cookieSession } = params;
  if (hostSessionId) {
    if (!cookieSession || cookieSession.id !== hostSessionId) {
      return null;
    }
    return cookieSession;
  }
  return cookieSession;
}
