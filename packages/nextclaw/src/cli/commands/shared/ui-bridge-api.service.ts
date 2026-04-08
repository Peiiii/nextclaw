import { ensureUiBridgeSecret } from "@nextclaw/server";
import { isProcessRunning, readServiceState } from "../../utils.js";

type ApiOkResponse<T> = {
  ok: true;
  data: T;
};

type ApiErrorResponse = {
  ok: false;
  error?: {
    message?: string;
  };
};

type ApiResponse<T> = ApiOkResponse<T> | ApiErrorResponse;

export type UiBridgeApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export function resolveManagedApiBase(): string | null {
  const state = readServiceState();
  if (!state?.pid) {
    return null;
  }
  if (!isProcessRunning(state.pid)) {
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

export class UiBridgeApiClient {
  private cookie: string | null | undefined;

  constructor(private readonly apiBase: string) {}

  private readonly getCookie = async (): Promise<string | null> => {
    if (this.cookie !== undefined) {
      return this.cookie;
    }
    const bridgeSecret = ensureUiBridgeSecret();
    const response = await fetch(`${this.apiBase}/api/auth/bridge`, {
      method: "POST",
      headers: {
        "x-nextclaw-ui-bridge-secret": bridgeSecret
      }
    });
    if (!response.ok) {
      throw new Error(`bridge auth failed with status ${response.status}`);
    }
    const payload = (await response.json()) as ApiResponse<{ cookie?: string | null }>;
    if (!payload.ok) {
      throw new Error(payload.error?.message ?? "bridge auth failed");
    }
    this.cookie =
      typeof payload.data.cookie === "string" && payload.data.cookie.trim()
        ? payload.data.cookie.trim()
        : null;
    return this.cookie;
  };

  readonly request = async <T>(params: {
    path: string;
    method?: UiBridgeApiMethod;
    body?: unknown;
  }): Promise<T> => {
    const cookie = await this.getCookie();
    const response = await fetch(`${this.apiBase}${params.path}`, {
      method: params.method ?? "GET",
      headers: {
        ...(params.body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      ...(params.body ? { body: JSON.stringify(params.body) } : {})
    });
    if (!response.ok) {
      throw new Error(`api request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) {
      throw new Error(payload.error?.message ?? "api request failed");
    }
    return payload.data;
  };
}
