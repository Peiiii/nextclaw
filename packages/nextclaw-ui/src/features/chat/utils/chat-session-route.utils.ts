const SESSION_ROUTE_PREFIX = 'sid_';

export function encodeSessionRouteId(sessionKey: string): string {
  const bytes = new TextEncoder().encode(sessionKey);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${SESSION_ROUTE_PREFIX}${base64}`;
}

export function decodeSessionRouteId(routeValue: string): string | null {
  if (!routeValue.startsWith(SESSION_ROUTE_PREFIX)) {
    return null;
  }
  const encoded = routeValue.slice(SESSION_ROUTE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (encoded.length % 4)) % 4);
  try {
    const binary = atob(encoded + padding);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function parseSessionKeyFromRoute(routeValue?: string): string | null {
  if (!routeValue) {
    return null;
  }
  const decodedToken = decodeSessionRouteId(routeValue);
  if (decodedToken) {
    return decodedToken;
  }
  try {
    return decodeURIComponent(routeValue);
  } catch {
    return routeValue;
  }
}

export function buildSessionPath(sessionKey: string): string {
  return `/chat/${encodeSessionRouteId(sessionKey)}`;
}
