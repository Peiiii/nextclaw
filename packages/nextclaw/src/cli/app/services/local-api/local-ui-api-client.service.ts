import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getDataDir, getRunPath } from "@nextclaw/core";

export type UiApiClient = {
  request: <T>(params: {
    path: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  }) => Promise<T>;
};

type LocalUiRuntimeState = {
  pid?: unknown;
  uiUrl?: unknown;
  apiUrl?: unknown;
};

type ApiResponse<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
};

export function createLocalUiApiClient(): UiApiClient | null {
  const apiBase = resolveLocalUiApiBase();
  return apiBase ? new LocalUiApiClient(apiBase) : null;
}

export class LocalUiApiClient implements UiApiClient {
  private cookie: string | null | undefined;

  constructor(private readonly apiBase: string) {}

  request = async <T>(params: {
    path: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  }): Promise<T> => {
    const { body, method, path } = params;
    const cookie = await this.getCookie();
    const headers: Record<string, string> = {};
    if (body) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`${this.apiBase}${path}`, {
      method: method ?? "GET",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const responseBody = await response.text();
    const payload = this.parsePayload<T>(responseBody);
    if (!response.ok) {
      const errorCode = payload && !payload.ok ? payload.error?.code : undefined;
      const errorMessage = payload && !payload.ok ? payload.error?.message : undefined;
      const detail = [errorCode, errorMessage].filter(Boolean).join(": ") ||
        responseBody.trim().slice(0, 240);
      throw new Error(
        `api request failed with status ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    if (!payload) {
      throw new Error("api request returned invalid JSON");
    }
    if (!payload.ok) {
      throw new Error(
        [payload.error?.code, payload.error?.message].filter(Boolean).join(": ") ||
          "api request failed",
      );
    }
    return payload.data;
  };

  private parsePayload = <T>(body: string): ApiResponse<T> | null => {
    try {
      return JSON.parse(body) as ApiResponse<T>;
    } catch {
      return null;
    }
  };

  private getCookie = async (): Promise<string | null> => {
    if (this.cookie !== undefined) return this.cookie;
    const response = await fetch(`${this.apiBase}/api/auth/bridge`, {
      method: "POST",
      headers: { "x-nextclaw-ui-bridge-secret": ensureUiBridgeSecret() },
    });
    if (!response.ok) {
      throw new Error(`bridge auth failed with status ${response.status}`);
    }
    const payload = await response.json() as ApiResponse<{ cookie?: string | null }>;
    if (!payload.ok) {
      throw new Error(payload.error?.message ?? "bridge auth failed");
    }
    this.cookie = typeof payload.data.cookie === "string" && payload.data.cookie.trim()
      ? payload.data.cookie.trim()
      : null;
    return this.cookie;
  };
}

function resolveLocalUiApiBase(): string | null {
  const state = readRunningRuntimeState(resolve(getRunPath(), "ui-runtime.json")) ??
    readRunningRuntimeState(resolve(getRunPath(), "service.json"));
  if (!state) return null;
  if (typeof state.uiUrl === "string" && state.uiUrl.trim()) {
    return state.uiUrl.replace(/\/+$/, "");
  }
  if (typeof state.apiUrl === "string" && state.apiUrl.trim()) {
    return state.apiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }
  return null;
}

function readRunningRuntimeState(statePath: string): LocalUiRuntimeState | null {
  if (!existsSync(statePath)) return null;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf-8")) as LocalUiRuntimeState;
    return typeof state.pid === "number" && isProcessRunning(state.pid) ? state : null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function ensureUiBridgeSecret(): string {
  const dirPath = join(getDataDir(), "remote");
  const secretPath = join(dirPath, "ui-bridge-secret");
  if (existsSync(secretPath)) {
    const existing = readFileSync(secretPath, "utf-8").trim();
    if (existing) return existing;
  }
  mkdirSync(dirPath, { recursive: true });
  const secret = randomBytes(24).toString("hex");
  writeFileSync(secretPath, `${secret}\n`, "utf-8");
  return secret;
}
