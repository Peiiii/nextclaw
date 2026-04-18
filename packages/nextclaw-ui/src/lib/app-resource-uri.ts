const APP_RESOURCE_URI_PREFIX = "app://";

function normalizeAppResourcePath(value: string): string | null {
  const normalized = value.trim().replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }
  const segments = normalized.split("/");
  if (
    segments.some((segment) => segment.trim().length === 0 || segment === "." || segment === "..")
  ) {
    return null;
  }
  return segments.join("/");
}

export function resolveAppResourceUri(uri: string): string | null {
  const normalized = uri.trim();
  if (!normalized) {
    return null;
  }
  if (!normalized.startsWith(APP_RESOURCE_URI_PREFIX)) {
    return normalized;
  }
  const appResourcePath = normalizeAppResourcePath(
    normalized.slice(APP_RESOURCE_URI_PREFIX.length),
  );
  return appResourcePath ? `/${appResourcePath}` : null;
}
