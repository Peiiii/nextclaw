const SESSION_COOKIE_NAME = "nextclaw_ui_session";

export function readAccessSessionTokenFromCookieHeader(rawHeader: string | null | undefined): string | null {
  if (!rawHeader) {
    return null;
  }
  for (const chunk of rawHeader.split(";")) {
    const [rawKey, ...rawValue] = chunk.split("=");
    const key = rawKey?.trim();
    if (key === SESSION_COOKIE_NAME) {
      const value = decodeURIComponent(rawValue.join("=").trim());
      return value.trim() ? value.trim() : null;
    }
  }
  return null;
}

export function buildAccessLoginCookie(params: {
  token: string;
  secure: boolean;
  expiresAt?: string;
}): string {
  const { expiresAt, secure, token } = params;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) {
    parts.push("Secure");
  }
  if (expiresAt) {
    const expiresAtMs = Date.parse(expiresAt);
    if (Number.isFinite(expiresAtMs)) {
      const maxAgeSeconds = Math.max(0, Math.trunc((expiresAtMs - Date.now()) / 1000));
      parts.push(`Max-Age=${maxAgeSeconds}`);
      parts.push(`Expires=${new Date(expiresAtMs).toUTCString()}`);
    }
  }
  return parts.join("; ");
}

export function buildAccessLogoutCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : null,
    "Max-Age=0",
    `Expires=${new Date(0).toUTCString()}`,
  ].filter((part): part is string => part !== null).join("; ");
}

export function resolveSecureRequest(url: string, protocolHint?: string | null): boolean {
  if (protocolHint?.trim().toLowerCase() === "https") {
    return true;
  }
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

