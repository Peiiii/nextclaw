import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import {
  ConfigSchema,
  loadConfig,
  saveConfig,
  type ProviderConfig,
  type ProviderDeviceCodeAuthMethodSpec,
  type ProviderDeviceCodeAuthProtocol,
  type ProviderDeviceCodeAuthSpec
} from "@nextclaw/core";
import type { ProviderAuthImportResult, ProviderAuthPollResult, ProviderAuthStartResult } from "./types.js";
import { findServerBuiltinProviderByName } from "./provider-overrides.js";

type DeviceCodeSession = {
  sessionId: string;
  provider: string;
  configPath: string;
  authorizationCode: string;
  tokenCodeField: "device_code" | "user_code";
  protocol: ProviderDeviceCodeAuthProtocol;
  methodId?: string;
  codeVerifier?: string;
  tokenEndpoint: string;
  clientId: string;
  grantType: string;
  defaultApiBase?: string;
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

type MiniMaxCodePayload = {
  user_code?: string;
  verification_uri?: string;
  expired_in?: number;
  interval?: number;
  state?: string;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type MiniMaxTokenPayload = {
  status?: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expired_in?: number | null;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
};

type ResolvedAuthMethod = {
  id?: string;
  protocol: ProviderDeviceCodeAuthProtocol;
  baseUrl: string;
  deviceCodePath: string;
  tokenPath: string;
  clientId: string;
  scope: string;
  grantType: string;
  usePkce: boolean;
  defaultApiBase?: string;
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

function normalizePositiveFloat(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
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

function resolveLocalizedMethodLabel(
  method: ProviderDeviceCodeAuthMethodSpec,
  fallbackId: string
): string | undefined {
  return method.label?.zh ?? method.label?.en ?? fallbackId;
}

function resolveLocalizedMethodHint(method: ProviderDeviceCodeAuthMethodSpec): string | undefined {
  return method.hint?.zh ?? method.hint?.en;
}

function normalizeMethodId(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveAuthMethod(auth: ProviderDeviceCodeAuthSpec, requestedMethodId?: string): ResolvedAuthMethod {
  const protocol = auth.protocol ?? "rfc8628";
  const methods = (auth.methods ?? []).filter((entry) => normalizeMethodId(entry.id));
  const cleanRequestedMethodId = normalizeMethodId(requestedMethodId);

  if (methods.length === 0) {
    if (cleanRequestedMethodId) {
      throw new Error(`provider auth method is not supported: ${cleanRequestedMethodId}`);
    }
    return {
      protocol,
      baseUrl: auth.baseUrl,
      deviceCodePath: auth.deviceCodePath,
      tokenPath: auth.tokenPath,
      clientId: auth.clientId,
      scope: auth.scope,
      grantType: auth.grantType,
      usePkce: Boolean(auth.usePkce)
    };
  }

  let selectedMethod = methods.find((entry) => normalizeMethodId(entry.id) === cleanRequestedMethodId);
  if (!selectedMethod) {
    const fallbackMethodId = normalizeMethodId(auth.defaultMethodId) ?? normalizeMethodId(methods[0]?.id);
    selectedMethod = methods.find((entry) => normalizeMethodId(entry.id) === fallbackMethodId) ?? methods[0];
  }
  const methodId = normalizeMethodId(selectedMethod?.id);
  if (!selectedMethod || !methodId) {
    throw new Error("provider auth method is not configured");
  }
  if (cleanRequestedMethodId && methodId !== cleanRequestedMethodId) {
    throw new Error(`provider auth method is not supported: ${cleanRequestedMethodId}`);
  }

  return {
    id: methodId,
    protocol,
    baseUrl: selectedMethod.baseUrl ?? auth.baseUrl,
    deviceCodePath: selectedMethod.deviceCodePath ?? auth.deviceCodePath,
    tokenPath: selectedMethod.tokenPath ?? auth.tokenPath,
    clientId: selectedMethod.clientId ?? auth.clientId,
    scope: selectedMethod.scope ?? auth.scope,
    grantType: selectedMethod.grantType ?? auth.grantType,
    usePkce: selectedMethod.usePkce ?? Boolean(auth.usePkce),
    defaultApiBase: selectedMethod.defaultApiBase
  };
}

function parseExpiresAtMs(
  value: unknown,
  fallbackFromNowMs: number
): number {
  const normalized = normalizePositiveFloat(value);
  if (normalized === null) {
    return Date.now() + fallbackFromNowMs;
  }
  if (normalized >= 1_000_000_000_000) {
    return Math.floor(normalized);
  }
  if (normalized >= 1_000_000_000) {
    return Math.floor(normalized * 1000);
  }
  return Date.now() + Math.floor(normalized * 1000);
}

function parsePollIntervalMs(value: unknown, fallbackMs: number): number {
  const normalized = normalizePositiveFloat(value);
  if (normalized === null) {
    return fallbackMs;
  }
  if (normalized <= 30) {
    return Math.floor(normalized * 1000);
  }
  return Math.floor(normalized);
}

function buildMinimaxErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }
  const record = payload as {
    base_resp?: { status_msg?: unknown };
    error?: unknown;
    error_description?: unknown;
  };
  if (typeof record.error_description === "string" && record.error_description.trim()) {
    return record.error_description.trim();
  }
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }
  const baseMessage = record.base_resp?.status_msg;
  if (typeof baseMessage === "string" && baseMessage.trim()) {
    return baseMessage.trim();
  }
  return fallback;
}

function classifyMiniMaxErrorStatus(message: string): "denied" | "expired" | "error" {
  const normalized = message.toLowerCase();
  if (normalized.includes("deny") || normalized.includes("rejected")) {
    return "denied";
  }
  if (normalized.includes("expired") || normalized.includes("timeout") || normalized.includes("timed out")) {
    return "expired";
  }
  return "error";
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
  providerName: string,
  options?: {
    methodId?: string;
  }
): Promise<ProviderAuthStartResult | null> {
  cleanupExpiredAuthSessions();

  const spec = findServerBuiltinProviderByName(providerName);
  if (!spec?.auth || spec.auth.kind !== "device_code") {
    return null;
  }
  const resolvedMethod = resolveAuthMethod(spec.auth, options?.methodId);

  const { deviceCodeEndpoint, tokenEndpoint } = resolveDeviceCodeEndpoints(
    resolvedMethod.baseUrl,
    resolvedMethod.deviceCodePath,
    resolvedMethod.tokenPath
  );
  const pkce = resolvedMethod.usePkce ? buildPkce() : null;

  let authorizationCode = "";
  let tokenCodeField: "device_code" | "user_code" = "device_code";
  let userCode = "";
  let verificationUri = "";
  let intervalMs = DEFAULT_AUTH_INTERVAL_MS;
  let expiresAtMs = Date.now() + 600_000;

  if (resolvedMethod.protocol === "minimax_user_code") {
    if (!pkce) {
      throw new Error("MiniMax OAuth requires PKCE");
    }
    const state = toBase64Url(randomBytes(16));
    const body = new URLSearchParams({
      response_type: "code",
      client_id: resolvedMethod.clientId,
      scope: resolvedMethod.scope,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state
    });
    const response = await fetch(deviceCodeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "x-request-id": randomUUID()
      },
      body
    });
    const payload = (await response.json().catch(() => ({}))) as MiniMaxCodePayload;
    if (!response.ok) {
      throw new Error(buildMinimaxErrorMessage(payload, response.statusText || "MiniMax OAuth start failed"));
    }
    if (payload.state && payload.state !== state) {
      throw new Error("MiniMax OAuth state mismatch");
    }
    authorizationCode = payload.user_code?.trim() ?? "";
    userCode = authorizationCode;
    verificationUri = payload.verification_uri?.trim() ?? "";
    if (!authorizationCode || !verificationUri) {
      throw new Error("provider auth payload is incomplete");
    }
    tokenCodeField = "user_code";
    intervalMs = Math.min(parsePollIntervalMs(payload.interval, DEFAULT_AUTH_INTERVAL_MS), MAX_AUTH_INTERVAL_MS);
    expiresAtMs = parseExpiresAtMs(payload.expired_in, 600_000);
  } else {
    const body = new URLSearchParams({
      client_id: resolvedMethod.clientId,
      scope: resolvedMethod.scope
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

    authorizationCode = payload.device_code?.trim() ?? "";
    userCode = payload.user_code?.trim() ?? "";
    verificationUri = payload.verification_uri_complete?.trim() || payload.verification_uri?.trim() || "";

    if (!authorizationCode || !userCode || !verificationUri) {
      throw new Error("provider auth payload is incomplete");
    }

    intervalMs = normalizePositiveInt(payload.interval, DEFAULT_AUTH_INTERVAL_MS / 1000) * 1000;
    const expiresInSec = normalizePositiveInt(payload.expires_in, 600);
    expiresAtMs = Date.now() + expiresInSec * 1000;
  }

  const sessionId = randomUUID();

  authSessions.set(sessionId, {
    sessionId,
    provider: providerName,
    configPath,
    authorizationCode,
    tokenCodeField,
    protocol: resolvedMethod.protocol,
    methodId: resolvedMethod.id,
    codeVerifier: pkce?.verifier,
    tokenEndpoint,
    clientId: resolvedMethod.clientId,
    grantType: resolvedMethod.grantType,
    defaultApiBase: resolvedMethod.defaultApiBase ?? spec.defaultApiBase,
    expiresAtMs,
    intervalMs
  });

  const methodConfig = (spec.auth.methods ?? []).find((entry) => normalizeMethodId(entry.id) === resolvedMethod.id);
  const methodLabel = methodConfig ? resolveLocalizedMethodLabel(methodConfig, resolvedMethod.id ?? "") : undefined;
  const methodHint = methodConfig ? resolveLocalizedMethodHint(methodConfig) : undefined;

  return {
    provider: providerName,
    kind: "device_code",
    methodId: resolvedMethod.id,
    sessionId,
    verificationUri,
    userCode,
    expiresAt: new Date(expiresAtMs).toISOString(),
    intervalMs,
    note: methodHint ?? methodLabel ?? resolveAuthNote(spec.auth.note ?? {})
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
    client_id: session.clientId
  });
  body.set(session.tokenCodeField, session.authorizationCode);
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
  let accessToken = "";

  if (session.protocol === "minimax_user_code") {
    const raw = await response.text();
    let payload: MiniMaxTokenPayload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw) as MiniMaxTokenPayload;
      } catch {
        payload = {};
      }
    }
    if (!response.ok) {
      const message = buildMinimaxErrorMessage(payload, raw || response.statusText || "authorization failed");
      return {
        provider: params.providerName,
        status: "error",
        message
      };
    }

    const status = payload.status?.trim().toLowerCase();
    if (status === "success") {
      accessToken = payload.access_token?.trim() ?? "";
      if (!accessToken) {
        return {
          provider: params.providerName,
          status: "error",
          message: "provider token response missing access token"
        };
      }
    } else if (status === "error") {
      const message = buildMinimaxErrorMessage(payload, "authorization failed");
      const classified = classifyMiniMaxErrorStatus(message);
      if (classified === "denied" || classified === "expired") {
        authSessions.delete(params.sessionId);
      }
      return {
        provider: params.providerName,
        status: classified,
        message
      };
    } else {
      const nextPollMs = Math.min(Math.floor(session.intervalMs * 1.5), MAX_AUTH_INTERVAL_MS);
      session.intervalMs = nextPollMs;
      authSessions.set(params.sessionId, session);
      return {
        provider: params.providerName,
        status: "pending",
        nextPollMs
      };
    }
  } else {
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

    accessToken = payload.access_token?.trim() ?? "";
    if (!accessToken) {
      return {
        provider: params.providerName,
        status: "error",
        message: "provider token response missing access token"
      };
    }
  }

  setProviderApiKey({
    configPath: params.configPath,
    provider: params.providerName,
    accessToken,
    defaultApiBase: session.defaultApiBase
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
  const spec = findServerBuiltinProviderByName(providerName);
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
