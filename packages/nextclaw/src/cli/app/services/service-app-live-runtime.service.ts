import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getDataDir, getRunPath } from "@nextclaw/core";
import type { ServiceAppRecord } from "@nextclaw/kernel";
import type {
  ServiceAppDevIssue,
  ServiceAppRestartReport,
} from "@nextclaw-cli/cli/app/types/service-app-dev.types.js";

type UiApiClient = {
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
    message?: string;
  };
};

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return String(error ?? "unknown error");
}

export class ServiceAppLiveRuntimeService {
  constructor(private readonly params: {
    createApiClient?: () => UiApiClient | null;
  } = {}) {}

  restart = async (appId: string): Promise<ServiceAppRestartReport> => {
    const target = appId.trim();
    const issues: ServiceAppDevIssue[] = [];
    if (!target) {
      issues.push({
        severity: "error",
        code: "service.id.invalid",
        message: "Service App id is required.",
      });
      return { ok: false, target, issues };
    }

    const apiClient = this.createApiClient();
    if (!apiClient) {
      issues.push({
        severity: "error",
        code: "service.runtime.notRunning",
        message: "NextClaw UI runtime is not running; start NextClaw before restarting a live Service App.",
      });
      return { ok: false, target, issues };
    }

    try {
      const app = await apiClient.request<ServiceAppRecord>({
        path: `/api/service-apps/${encodeURIComponent(target)}/restart`,
        method: "POST",
      });
      return {
        ok: true,
        target,
        app,
        issues,
      };
    } catch (error) {
      issues.push({
        severity: "error",
        code: "service.runtime.restartFailed",
        message: readErrorMessage(error),
      });
      return { ok: false, target, issues };
    }
  };

  private createApiClient = (): UiApiClient | null => {
    if (this.params.createApiClient) {
      return this.params.createApiClient();
    }
    const apiBase = resolveLocalUiApiBase();
    return apiBase ? new LocalUiApiClient(apiBase) : null;
  };
}

class LocalUiApiClient {
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
    if (body) {
      headers["Content-Type"] = "application/json";
    }
    if (cookie) {
      headers.Cookie = cookie;
    }
    const requestInit: {
      method: string;
      headers: Record<string, string>;
      body?: string;
    } = {
      method: method ?? "GET",
      headers,
    };
    if (body) {
      requestInit.body = JSON.stringify(body);
    }
    const response = await fetch(`${this.apiBase}${path}`, requestInit);
    if (!response.ok) {
      throw new Error(`api request failed with status ${response.status}`);
    }
    const payload = await response.json() as ApiResponse<T>;
    if (!payload.ok) {
      throw new Error(payload.error?.message ?? "api request failed");
    }
    return payload.data;
  };

  private getCookie = async (): Promise<string | null> => {
    if (this.cookie !== undefined) {
      return this.cookie;
    }
    const response = await fetch(`${this.apiBase}/api/auth/bridge`, {
      method: "POST",
      headers: {
        "x-nextclaw-ui-bridge-secret": ensureUiBridgeSecret(),
      },
    });
    if (!response.ok) {
      throw new Error(`bridge auth failed with status ${response.status}`);
    }
    const payload = await response.json() as ApiResponse<{ cookie?: string | null }>;
    if (!payload.ok) {
      throw new Error(payload.error?.message ?? "bridge auth failed");
    }
    this.cookie =
      typeof payload.data.cookie === "string" && payload.data.cookie.trim().length > 0
        ? payload.data.cookie.trim()
        : null;
    return this.cookie;
  };
}

function resolveLocalUiApiBase(): string | null {
  const state = readRunningRuntimeState(resolve(getRunPath(), "ui-runtime.json")) ??
    readRunningRuntimeState(resolve(getRunPath(), "service.json"));
  if (!state) {
    return null;
  }
  if (typeof state.uiUrl === "string" && state.uiUrl.trim().length > 0) {
    return state.uiUrl.replace(/\/+$/, "");
  }
  if (typeof state.apiUrl === "string" && state.apiUrl.trim().length > 0) {
    return state.apiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }
  return null;
}

function readRunningRuntimeState(statePath: string): LocalUiRuntimeState | null {
  if (!existsSync(statePath)) {
    return null;
  }
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
    if (existing.length > 0) {
      return existing;
    }
  }
  mkdirSync(dirPath, { recursive: true });
  const secret = randomBytes(24).toString("hex");
  writeFileSync(secretPath, `${secret}\n`, "utf-8");
  return secret;
}
