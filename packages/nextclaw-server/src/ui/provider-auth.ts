import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import {
  ConfigSchema,
  loadConfig,
  saveConfig,
  type ProviderConfig
} from "@nextclaw/core";
import { findBuiltinProviderByName } from "@nextclaw/runtime";
import type { ProviderAuthImportResult, ProviderAuthPollResult, ProviderAuthStartResult } from "./types.js";

type DeviceCodeSession = {
  sessionId: string;
  provider: string;
  configPath: string;
  deviceCode: string;
  codeVerifier?: string;
  tokenEndpoint: string;
  clientId: string;
  grantType: string;
  expiresAtMs: number;
  intervalMs: number;
};

type DeviceCodePayload = {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  interval?: number;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

const authSessions = new Map<string, DeviceCodeSession>();
const DEFAULT_AUTH_INTERVAL_MS = 2000;
const MAX_AUTH_INTERVAL_MS = 10000;

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildPkce(): { verifier: string; challenge: string } {
  const verifier = toBase64Url(randomBytes(48));
  const challenge = toBase64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function cleanupExpiredAuthSessions(now = Date.now()): void {
  for (const [sessionId, session] of authSessions.entries()) {
    if (session.expiresAtMs <= now) {
      authSessions.delete(sessionId);
    }
  }
}

function resolveDeviceCodeEndpoints(baseUrl: string, deviceCodePath: string, tokenPath: string): {
  deviceCodeEndpoint: string;
  tokenEndpoint: string;
} {
  const deviceCodeEndpoint = new URL(deviceCodePath, withTrailingSlash(baseUrl)).toString();
  const tokenEndpoint = new URL(tokenPath, withTrailingSlash(baseUrl)).toString();
  return { deviceCodeEndpoint, tokenEndpoint };
}

function resolveAuthNote(params: {
  zh?: string;
  en?: string;
}): string | undefined {
  return params.zh ?? params.en;
}

function resolveHomePath(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed === "~") {
    return homedir();
  }
  if (trimmed.startsWith("~/")) {
    return resolve(homedir(), trimmed.slice(2));
  }
  if (isAbsolute(trimmed)) {
    return trimmed;
  }
  return resolve(trimmed);
}

function normalizeExpiresAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return Math.floor(asNumber);
    }
    const parsedTime = Date.parse(value);
    if (Number.isFinite(parsedTime) && parsedTime > 0) {
      return parsedTime;
    }
  }
  return null;
}

function readFieldAsString(source: Record<string, unknown>, fieldName: string | undefined): string | null {
  if (!fieldName) {
    return null;
  }
  const rawValue = source[fieldName];
  if (typeof rawValue !== "string") {
    return null;
  }
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function setProviderApiKey(params: {
  configPath: string;
  provider: string;
  accessToken: string;
  defaultApiBase?: string;
}): void {
  const config = loadConfig(params.configPath);
  const providers = config.providers as Record<string, ProviderConfig>;
  if (!providers[params.provider]) {
    providers[params.provider] = {
      displayName: "",
      apiKey: "",
      apiBase: null,
      extraHeaders: null,
      wireApi: "auto",
      models: []
    };
  }

  const target = providers[params.provider];
  target.apiKey = params.accessToken;
  if (!target.apiBase && params.defaultApiBase) {
    target.apiBase = params.defaultApiBase;
  }

  const next = ConfigSchema.parse(config);
  saveConfig(next, params.configPath);
}

export async function startProviderAuth(
  configPath: string,
  providerName: string
): Promise<ProviderAuthStartResult | null> {
  cleanupExpiredAuthSessions();

  const spec = findBuiltinProviderByName(providerName);
  if (!spec?.auth || spec.auth.kind !== "device_code") {
    return null;
  }

  const { deviceCodeEndpoint, tokenEndpoint } = resolveDeviceCodeEndpoints(
    spec.auth.baseUrl,
    spec.auth.deviceCodePath,
    spec.auth.tokenPath
  );

  const pkce = spec.auth.usePkce ? buildPkce() : null;
  const body = new URLSearchParams({
    client_id: spec.auth.clientId,
    scope: spec.auth.scope
  });
  if (pkce) {
    body.set("code_challenge", pkce.challenge);
    body.set("code_challenge_method", "S256");
  }

  const response = await fetch(deviceCodeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  const payload = (await response.json().catch(() => ({}))) as DeviceCodePayload;
  if (!response.ok) {
    const message = payload.error_description || payload.error || response.statusText || "device code auth failed";
    throw new Error(message);
  }

  const deviceCode = payload.device_code?.trim() ?? "";
  const userCode = payload.user_code?.trim() ?? "";
  const verificationUri =
    payload.verification_uri_complete?.trim() || payload.verification_uri?.trim() || "";

  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error("provider auth payload is incomplete");
  }

  const intervalMs = normalizePositiveInt(payload.interval, DEFAULT_AUTH_INTERVAL_MS / 1000) * 1000;
  const expiresInSec = normalizePositiveInt(payload.expires_in, 600);
  const expiresAtMs = Date.now() + expiresInSec * 1000;
  const sessionId = randomUUID();

  authSessions.set(sessionId, {
    sessionId,
    provider: providerName,
    configPath,
    deviceCode,
    codeVerifier: pkce?.verifier,
    tokenEndpoint,
    clientId: spec.auth.clientId,
    grantType: spec.auth.grantType,
    expiresAtMs,
    intervalMs
  });

  return {
    provider: providerName,
    kind: "device_code",
    sessionId,
    verificationUri,
    userCode,
    expiresAt: new Date(expiresAtMs).toISOString(),
    intervalMs,
    note: resolveAuthNote(spec.auth.note ?? {})
  };
}

export async function pollProviderAuth(params: {
  configPath: string;
  providerName: string;
  sessionId: string;
}): Promise<ProviderAuthPollResult | null> {
  cleanupExpiredAuthSessions();

  const session = authSessions.get(params.sessionId);
  if (!session || session.provider !== params.providerName || session.configPath !== params.configPath) {
    return null;
  }

  if (Date.now() >= session.expiresAtMs) {
    authSessions.delete(params.sessionId);
    return {
      provider: params.providerName,
      status: "expired",
      message: "authorization session expired"
    };
  }

  const body = new URLSearchParams({
    grant_type: session.grantType,
    client_id: session.clientId,
    device_code: session.deviceCode
  });
  if (session.codeVerifier) {
    body.set("code_verifier", session.codeVerifier);
  }

  const response = await fetch(session.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  const payload = (await response.json().catch(() => ({}))) as TokenPayload;
  if (!response.ok) {
    const errorCode = payload.error?.trim().toLowerCase();
    if (errorCode === "authorization_pending") {
      return {
        provider: params.providerName,
        status: "pending",
        nextPollMs: session.intervalMs
      };
    }

    if (errorCode === "slow_down") {
      const nextPollMs = Math.min(Math.floor(session.intervalMs * 1.5), MAX_AUTH_INTERVAL_MS);
      session.intervalMs = nextPollMs;
      authSessions.set(params.sessionId, session);
      return {
        provider: params.providerName,
        status: "pending",
        nextPollMs
      };
    }

    if (errorCode === "access_denied") {
      authSessions.delete(params.sessionId);
      return {
        provider: params.providerName,
        status: "denied",
        message: payload.error_description || "authorization denied"
      };
    }

    if (errorCode === "expired_token") {
      authSessions.delete(params.sessionId);
      return {
        provider: params.providerName,
        status: "expired",
        message: payload.error_description || "authorization session expired"
      };
    }

    return {
      provider: params.providerName,
      status: "error",
      message: payload.error_description || payload.error || response.statusText || "authorization failed"
    };
  }

  const accessToken = payload.access_token?.trim();
  if (!accessToken) {
    return {
      provider: params.providerName,
      status: "error",
      message: "provider token response missing access token"
    };
  }

  const spec = findBuiltinProviderByName(params.providerName);
  setProviderApiKey({
    configPath: params.configPath,
    provider: params.providerName,
    accessToken,
    defaultApiBase: spec?.defaultApiBase
  });

  authSessions.delete(params.sessionId);
  return {
    provider: params.providerName,
    status: "authorized"
  };
}

export async function importProviderAuthFromCli(
  configPath: string,
  providerName: string
): Promise<ProviderAuthImportResult | null> {
  const spec = findBuiltinProviderByName(providerName);
  if (!spec?.auth || spec.auth.kind !== "device_code" || !spec.auth.cliCredential) {
    return null;
  }

  const credentialPath = resolveHomePath(spec.auth.cliCredential.path);
  if (!credentialPath) {
    throw new Error("provider cli credential path is empty");
  }

  let rawContent = "";
  try {
    rawContent = await readFile(credentialPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to read CLI credential: ${message}`);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawContent) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("credential payload is not an object");
    }
    payload = parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid CLI credential JSON: ${message}`);
  }

  const accessToken = readFieldAsString(payload, spec.auth.cliCredential.accessTokenField);
  if (!accessToken) {
    throw new Error(
      `CLI credential missing access token field: ${spec.auth.cliCredential.accessTokenField}`
    );
  }

  const expiresAtMs = normalizeExpiresAt(
    spec.auth.cliCredential.expiresAtField
      ? payload[spec.auth.cliCredential.expiresAtField]
      : undefined
  );
  if (typeof expiresAtMs === "number" && expiresAtMs <= Date.now()) {
    throw new Error("CLI credential has expired, please login again");
  }

  setProviderApiKey({
    configPath,
    provider: providerName,
    accessToken,
    defaultApiBase: spec.defaultApiBase
  });

  return {
    provider: providerName,
    status: "imported",
    source: "cli",
    expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : undefined
  };
}
