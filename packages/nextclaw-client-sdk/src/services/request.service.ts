import type { ApiError, ApiResponse } from "@nextclaw/server";
import type {
  NextClawClientOptions,
  NextClawRequestOptions,
  NextClawUploadOptions
} from "../types/nextclaw-request.types.js";
import type { NextClawQueryParams } from "../types/nextclaw-transport.types.js";
import { appendQueryToPath, resolveApiUrl } from "../utils/url.utils.js";

export class NextClawClientError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(params: { message: string; status?: number; code?: string; details?: Record<string, unknown> }) {
    const { code, details, message, status } = params;
    super(message);
    this.name = "NextClawClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTransportErrorField(error: unknown, key: "code" | "details" | "status"): unknown {
  return isRecord(error) ? error[key] : undefined;
}

export class RequestService {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly transport;

  constructor(private readonly options: NextClawClientOptions) {
    const { baseUrl, fetchImpl, headers, requestTimeoutMs, token } = options;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl ?? fetch;
    this.requestTimeoutMs = Math.max(1000, requestTimeoutMs ?? 15000);
    this.transport = options.transport;
    this.defaultHeaders = {
      Accept: "application/json",
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  readonly request = async <T>(path: string, options: NextClawRequestOptions = {}): Promise<T> => {
    const { body, headers, method, query, signal, timeoutMs } = options;
    if (this.transport) {
      return await this.requestWithTransport(path, options);
    }

    const controller = new AbortController();
    const effectiveTimeoutMs = Math.max(1000, timeoutMs ?? this.requestTimeoutMs);
    const abortOnSignal = this.bindAbortSignal(controller, signal);
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);
    const requestHeaders = {
      ...this.defaultHeaders,
      ...(headers ?? {})
    };
    const requestBody = this.normalizeRequestBody(body, requestHeaders);

    try {
      const response = await this.fetchImpl(resolveApiUrl(this.baseUrl, appendQueryToPath(path, this.serializeQuery(query))), {
        method: method ?? "GET",
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal
      });
      const payload = (await response.json()) as ApiResponse<T> | ApiError;

      if (!response.ok) {
        const errorPayload = this.extractApiError(payload);
        throw new NextClawClientError({
          message: errorPayload.message,
          status: response.status,
          code: errorPayload.code,
          details: errorPayload.details
        });
      }

      if (!this.isApiResponse<T>(payload)) {
        throw new NextClawClientError({
          message: "Unexpected NextClaw API response shape.",
          status: response.status
        });
      }

      if (!payload.ok) {
        throw new NextClawClientError({
          message: payload.error.message,
          status: response.status,
          code: payload.error.code,
          details: payload.error.details
        });
      }

      return payload.data;
    } catch (error) {
      if (error instanceof NextClawClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new NextClawClientError({
          message: `NextClaw API request timed out after ${effectiveTimeoutMs}ms.`
        });
      }
      throw new NextClawClientError({
        message: error instanceof Error ? error.message : "NextClaw API request failed."
      });
    } finally {
      signal?.removeEventListener("abort", abortOnSignal);
      clearTimeout(timeoutId);
    }
  };

  private readonly bindAbortSignal = (
    controller: AbortController,
    signal: AbortSignal | undefined,
  ): (() => void) => {
    const abortOnSignal = () => controller.abort(signal?.reason);
    if (!signal) {
      return abortOnSignal;
    }
    if (signal.aborted) {
      controller.abort(signal.reason);
      return abortOnSignal;
    }
    signal.addEventListener("abort", abortOnSignal, { once: true });
    return abortOnSignal;
  };

  private readonly requestWithTransport = async <T>(
    path: string,
    options: NextClawRequestOptions,
  ): Promise<T> => {
    const { body, headers, method, query, signal, timeoutMs } = options;
    const { transport } = this;
    if (!transport) {
      throw new NextClawClientError({ message: "NextClaw transport is not configured." });
    }
    try {
      return await transport.request<T>({
        method: method ?? "GET",
        path,
        ...(body !== undefined ? { body } : {}),
        ...(query ? { query } : {}),
        ...(headers ? { headers } : {}),
        ...(signal ? { signal } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {})
      });
    } catch (error) {
      if (error instanceof NextClawClientError) {
        throw error;
      }
      const code = readTransportErrorField(error, "code");
      const details = readTransportErrorField(error, "details");
      const status = readTransportErrorField(error, "status");
      throw new NextClawClientError({
        message: error instanceof Error ? error.message : "NextClaw API request failed.",
        code: typeof code === "string" ? code : undefined,
        details: isRecord(details) ? details : undefined,
        status: typeof status === "number" ? status : undefined
      });
    }
  };

  readonly get = async <T>(
    path: string,
    options: Omit<NextClawRequestOptions, "method" | "body"> = {}
  ): Promise<T> => {
    return await this.request<T>(path, { ...options, method: "GET" });
  };

  readonly post = async <T>(
    path: string,
    body?: unknown,
    options: Omit<NextClawRequestOptions, "method" | "body"> = {}
  ): Promise<T> => {
    return await this.request<T>(path, { ...options, method: "POST", ...(body !== undefined ? { body } : {}) });
  };

  readonly put = async <T>(
    path: string,
    body?: unknown,
    options: Omit<NextClawRequestOptions, "method" | "body"> = {}
  ): Promise<T> => {
    return await this.request<T>(path, { ...options, method: "PUT", ...(body !== undefined ? { body } : {}) });
  };

  readonly delete = async <T>(
    path: string,
    options: Omit<NextClawRequestOptions, "method" | "body"> = {}
  ): Promise<T> => {
    return await this.request<T>(path, { ...options, method: "DELETE" });
  };

  readonly upload = async <T>(
    path: string,
    formData: FormData,
    options: NextClawUploadOptions = {}
  ): Promise<T> => {
    const { headers, signal, timeoutMs } = options;
    if (this.transport?.upload) {
      return await this.transport.upload<T>({
        path,
        formData,
        ...(headers ? { headers } : {}),
        ...(signal ? { signal } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {})
      });
    }

    const controller = new AbortController();
    const effectiveTimeoutMs = Math.max(1000, timeoutMs ?? this.requestTimeoutMs);
    const abortOnSignal = () => controller.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener("abort", abortOnSignal, { once: true });
      }
    }
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    try {
      const response = await this.fetchImpl(resolveApiUrl(this.baseUrl, path), {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(tokenHeader(this.options.token) ?? {}),
          ...(this.options.headers ?? {}),
          ...(headers ?? {})
        },
        body: formData,
        signal: controller.signal
      });
      const payload = (await response.json()) as ApiResponse<T> | ApiError;
      if (!response.ok) {
        const errorPayload = this.extractApiError(payload);
        throw new NextClawClientError({
          message: errorPayload.message,
          status: response.status,
          code: errorPayload.code,
          details: errorPayload.details
        });
      }
      if (!this.isApiResponse<T>(payload) || !payload.ok) {
        throw new NextClawClientError({
          message: "Unexpected NextClaw upload response shape.",
          status: response.status
        });
      }
      return payload.data;
    } catch (error) {
      if (error instanceof NextClawClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new NextClawClientError({
          message: `NextClaw API upload timed out after ${effectiveTimeoutMs}ms.`
        });
      }
      throw new NextClawClientError({
        message: error instanceof Error ? error.message : "NextClaw API upload failed."
      });
    } finally {
      signal?.removeEventListener("abort", abortOnSignal);
      clearTimeout(timeoutId);
    }
  };

  private readonly isApiResponse = <T>(value: unknown): value is ApiResponse<T> => {
    return value !== null && typeof value === "object" && "ok" in value;
  };

  private readonly extractApiError = (value: unknown): ApiError => {
    if (this.isApiResponse<unknown>(value) && !value.ok) {
      return value.error;
    }
    if (value !== null && typeof value === "object" && "message" in value) {
      const errorCandidate = value as {
        code?: unknown;
        message?: unknown;
        details?: unknown;
      };
      return {
        code: typeof errorCandidate.code === "string" ? errorCandidate.code : "HTTP_ERROR",
        message: typeof errorCandidate.message === "string" ? errorCandidate.message : "NextClaw API request failed.",
        details:
          errorCandidate.details !== null && typeof errorCandidate.details === "object"
            ? (errorCandidate.details as Record<string, unknown>)
            : undefined
      };
    }
    return {
      code: "HTTP_ERROR",
      message: "NextClaw API request failed."
    };
  };

  private readonly normalizeRequestBody = (
    body: unknown,
    headers: Record<string, string>
  ): BodyInit | undefined => {
    if (body === undefined) {
      return undefined;
    }
    if (
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof Blob ||
      body instanceof ArrayBuffer
    ) {
      return body;
    }
    if (typeof body === "string") {
      if (!("Content-Type" in headers) && !("content-type" in headers)) {
        headers["Content-Type"] = "application/json";
      }
      return body;
    }
    if (!("Content-Type" in headers) && !("content-type" in headers)) {
      headers["Content-Type"] = "application/json";
    }
    return JSON.stringify(body);
  };

  private readonly serializeQuery = (query?: NextClawQueryParams): URLSearchParams | undefined => {
    if (!query) {
      return undefined;
    }
    if (query instanceof URLSearchParams) {
      return query;
    }
    const params = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(query)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        if (value === null || value === undefined) {
          continue;
        }
        params.append(key, String(value));
      }
    }
    return params;
  };
}

function tokenHeader(token?: string): Record<string, string> | null {
  return token ? { Authorization: `Bearer ${token}` } : null;
}
