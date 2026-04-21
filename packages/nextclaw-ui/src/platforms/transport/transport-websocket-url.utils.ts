export function resolveTransportWebSocketUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/$/, '');
  try {
    const resolved = new URL(normalizedBase, window.location.origin);
    const protocol =
      resolved.protocol === 'https:'
        ? 'wss:'
        : resolved.protocol === 'http:'
          ? 'ws:'
          : resolved.protocol;
    return `${protocol}//${resolved.host}${path}`;
  } catch {
    if (normalizedBase.startsWith('wss://') || normalizedBase.startsWith('ws://')) {
      return `${normalizedBase}${path}`;
    }
    if (normalizedBase.startsWith('https://')) {
      return `${normalizedBase.replace(/^https:/, 'wss:')}${path}`;
    }
    if (normalizedBase.startsWith('http://')) {
      return `${normalizedBase.replace(/^http:/, 'ws:')}${path}`;
    }
    return `${normalizedBase}${path}`;
  }
}
