import type { MarketplaceSkillPublishActor } from "../../infrastructure/d1-data-source";

const DEFAULT_PLATFORM_API_BASE = "https://ai-gateway-api.nextclaw.io";
type MarketplaceAuthContext = {
  env: {
    MARKETPLACE_ADMIN_TOKEN?: string;
    NEXTCLAW_PLATFORM_API_BASE?: string;
  };
  req: {
    header: (name: string) => string | undefined;
  };
};

export class MarketplaceAuthError extends Error {}

export function requireAdminToken(c: MarketplaceAuthContext): void {
  const expected = c.env.MARKETPLACE_ADMIN_TOKEN?.trim();
  const auth = c.req.header("authorization")?.trim();
  if (expected && auth === `Bearer ${expected}`) {
    return;
  }
  throw new MarketplaceAuthError("missing or invalid admin token");
}

export async function resolvePublishActor(c: MarketplaceAuthContext): Promise<MarketplaceSkillPublishActor> {
  const auth = c.req.header("authorization")?.trim();
  if (!auth) {
    throw new MarketplaceAuthError("missing authorization header");
  }

  const adminToken = c.env.MARKETPLACE_ADMIN_TOKEN?.trim();
  if (adminToken && auth === `Bearer ${adminToken}`) {
    return {
      authType: "admin_token",
      role: "admin",
      userId: null,
      username: "nextclaw"
    };
  }

  const response = await fetch(`${resolvePlatformApiBase(c)}/platform/auth/me`, {
    headers: {
      authorization: auth,
      accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    throw new MarketplaceAuthError("invalid or expired platform token");
  }
  if (!response.ok) {
    throw new Error(`platform auth lookup failed: ${response.status}`);
  }

  const user = readPlatformUserPayload(payload);
  return {
    authType: "platform_user",
    role: user.role,
    userId: user.id,
    username: user.username
  };
}

function resolvePlatformApiBase(c: MarketplaceAuthContext): string {
  const base = c.env.NEXTCLAW_PLATFORM_API_BASE?.trim() || DEFAULT_PLATFORM_API_BASE;
  return base.replace(/\/+$/, "");
}

function readPlatformUserPayload(payload: unknown): {
  id: string;
  email: string;
  username: string | null;
  role: "admin" | "user";
} {
  const user = typeof payload === "object" &&
    payload &&
    "data" in payload &&
    typeof (payload as { data?: { user?: unknown } }).data?.user === "object" &&
    (payload as { data: { user: unknown } }).data.user
    ? (payload as { data: { user: Record<string, unknown> } }).data.user
    : null;
  const id = typeof user?.id === "string" ? user.id.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  const username = typeof user?.username === "string"
    ? user.username.trim()
    : user?.username === null
      ? null
      : null;
  const role = user?.role === "admin" ? "admin" : "user";
  if (!id || !email) {
    throw new MarketplaceAuthError("platform auth payload is incomplete");
  }
  return {
    id,
    email,
    username: username && username.length > 0 ? username : null,
    role
  };
}
