const APP_RESOURCE_URI_PREFIX = "app://";

function normalizeAppResourcePath(value: string): string {
  const normalized = value.trim().replace(/^\/+/, "");
  if (!normalized) {
    throw new Error("app resource path must not be empty");
  }
  const segments = normalized.split("/");
  if (
    segments.some((segment) => segment.trim().length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`invalid app resource path: ${value}`);
  }
  return segments.join("/");
}

export function createAppResourceUri(resourcePath: string): string {
  return `${APP_RESOURCE_URI_PREFIX}${normalizeAppResourcePath(resourcePath)}`;
}

export function parseAppResourceUri(uri: string): string | null {
  const normalized = uri.trim();
  if (!normalized.startsWith(APP_RESOURCE_URI_PREFIX)) {
    return null;
  }
  try {
    return normalizeAppResourcePath(normalized.slice(APP_RESOURCE_URI_PREFIX.length));
  } catch {
    return null;
  }
}
