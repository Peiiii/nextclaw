import { ensureUiBridgeSecret } from "@nextclaw/server";
import { localUiDiscoveryService } from "./local-ui-discovery.service.js";

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

export type UiBridgeApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function resolveLocalUiApiBase(): string | null {
  return localUiDiscoveryService.resolveApiBase();
}

export class UiBridgeApiClient {
  private cookie: string | null | undefined;

  constructor(private readonly apiBase: string) {}

  private readonly getCookie = async (signal?: AbortSignal | null): Promise<string | null> => {
    if (this.cookie !== undefined) {
      return this.cookie;
    }
    const target = new URL(this.apiBase);
    if (!["127.0.0.1", "[::1]"].includes(target.hostname) ||
        !["http:", "https:"].includes(target.protocol) || target.username || target.password) {
      throw new Error("Local bridge authentication requires a loopback API address.");
    }
    const bridgeSecret = ensureUiBridgeSecret();
    const response = await fetch(`${this.apiBase}/api/auth/bridge`, {
      method: "POST",
      redirect: "error",
      signal,
      headers: {
        "x-nextclaw-ui-bridge-secret": bridgeSecret,
      },
    });
    if (!response.ok) {
      throw new Error(`bridge auth failed with status ${response.status}`);
    }
    const payload = (await response.json()) as ApiResponse<{
      cookie?: string | null;
    }>;
    if (!payload.ok) {
      throw new Error(payload.error?.message ?? "bridge auth failed");
    }
    this.cookie =
      typeof payload.data.cookie === "string" && payload.data.cookie.trim()
        ? payload.data.cookie.trim()
        : null;
    return this.cookie;
  };

  readonly requestResponse = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(path, this.apiBase);
    if (url.origin !== new URL(this.apiBase).origin) {
      throw new Error("Local API requests must stay on the configured origin.");
    }
    const send = (): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (this.cookie) headers.set("Cookie", this.cookie);
      headers.set("x-nextclaw-request-source", "cli");
      return fetch(url.href, { ...init, headers, redirect: "error" });
    };
    const response = await send();
    if (response.status !== 401) return response;
    await response.body?.cancel();
    this.cookie = undefined;
    await this.getCookie(init.signal);
    return send();
  };

  readonly request = async <T>(params: {
    path: string;
    method?: UiBridgeApiMethod;
    body?: unknown;
  }): Promise<T> => {
    const { body, method, path } = params;
    const response = await this.requestResponse(path, {
      method: method ?? "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
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
