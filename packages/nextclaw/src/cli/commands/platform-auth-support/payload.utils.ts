import type { PlatformUserView } from "../platform-auth.js";

export function readLoginPayload(raw: string): { token: string; role: string } {
  const authResult = readPlatformAuthResultPayload(raw);
  return {
    token: authResult.token,
    role: authResult.user.role
  };
}

export function readPlatformUserPayload(raw: string): PlatformUserView {
  const parsed = parseJsonText(raw);
  const data = typeof parsed === "object" && parsed && "data" in parsed
    ? (parsed as { data?: Record<string, unknown> }).data
    : null;
  const user = typeof data?.user === "object" && data.user ? data.user as Record<string, unknown> : null;
  const id = typeof user?.id === "string" ? user.id.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  const role = typeof user?.role === "string" ? user.role.trim() : "user";
  const username = typeof user?.username === "string"
    ? user.username.trim()
    : user?.username === null
      ? null
      : null;
  if (!id || !email) {
    throw new Error("Platform user payload is incomplete.");
  }
  return {
    id,
    email,
    username: username && username.length > 0 ? username : null,
    role
  };
}

export function readPlatformAuthResultPayload(raw: string): { token: string; user: PlatformUserView } {
  const parsed = parseJsonText(raw);
  const token = typeof parsed === "object" &&
    parsed &&
    "data" in parsed &&
    typeof (parsed as { data?: { token?: unknown } }).data?.token === "string"
    ? (parsed as { data: { token: string } }).data.token
    : "";
  const user = readPlatformUserPayload(raw);
  if (!token) {
    throw new Error("Login succeeded but token is missing.");
  }
  return { token, user };
}

export function readPlatformErrorMessage(raw: string, fallbackStatus: number): string {
  const parsed = parseJsonText(raw);
  return typeof parsed === "object" &&
    parsed &&
    "error" in parsed &&
    typeof (parsed as { error?: { message?: unknown } }).error?.message === "string"
    ? (parsed as { error: { message: string } }).error.message
    : raw || `Request failed (${fallbackStatus})`;
}

export function readBrowserAuthStartPayload(raw: string): {
  sessionId: string;
  verificationUri: string;
  expiresAt: string;
  intervalMs: number;
} {
  const parsed = parseJsonText(raw);
  const data = typeof parsed === "object" && parsed && "data" in parsed
    ? (parsed as { data?: Record<string, unknown> }).data
    : null;
  const sessionId = typeof data?.sessionId === "string" ? data.sessionId.trim() : "";
  const verificationUri = typeof data?.verificationUri === "string" ? data.verificationUri.trim() : "";
  const expiresAt = typeof data?.expiresAt === "string" ? data.expiresAt.trim() : "";
  const intervalMs = typeof data?.intervalMs === "number" && Number.isFinite(data.intervalMs)
    ? Math.max(1000, Math.trunc(data.intervalMs))
    : 1500;
  if (!sessionId || !verificationUri || !expiresAt) {
    throw new Error("Browser authorization session payload is incomplete.");
  }
  return {
    sessionId,
    verificationUri,
    expiresAt,
    intervalMs
  };
}

export function readBrowserAuthPollPayload(raw: string): {
  status: "pending" | "authorized" | "expired";
  nextPollMs?: number;
  token?: string;
  role?: string;
  email?: string;
  message?: string;
} {
  const parsed = parseJsonText(raw);
  const data = typeof parsed === "object" && parsed && "data" in parsed
    ? (parsed as { data?: Record<string, unknown> }).data
    : null;
  const status = typeof data?.status === "string" ? data.status.trim() : "";
  if (status === "pending") {
    return {
      status,
      nextPollMs: typeof data?.nextPollMs === "number" && Number.isFinite(data.nextPollMs)
        ? Math.max(1000, Math.trunc(data.nextPollMs))
        : 1500
    };
  }
  if (status === "expired") {
    return {
      status,
      message: typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : "Authorization session expired."
    };
  }
  if (status !== "authorized") {
    throw new Error("Unexpected browser authorization status.");
  }
  const token = typeof data?.token === "string" ? data.token.trim() : "";
  const user = typeof data?.user === "object" && data.user ? data.user as Record<string, unknown> : null;
  const role = typeof user?.role === "string" ? user.role.trim() : "user";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (!token || !email) {
    throw new Error("Authorized browser login payload is incomplete.");
  }
  return {
    status,
    token,
    role,
    email
  };
}

function parseJsonText(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
