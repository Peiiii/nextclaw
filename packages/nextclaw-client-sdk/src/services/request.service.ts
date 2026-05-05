import type { NextClawApiError, NextClawApiResponse } from "../types/api.types.js";
import type { NextClawClientOptions, NextClawRequestOptions } from "../types/client-sdk.types.js";
import { resolveApiUrl } from "../utils/url.utils.js";

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

export class RequestService {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: NextClawClientOptions) {
    const { baseUrl, fetchImpl, headers, requestTimeoutMs, token } = options;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl ?? fetch;
    this.requestTimeoutMs = Math.max(1000, requestTimeoutMs ?? 15000);
    this.defaultHeaders = {
      Accept: "application/json",
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  readonly request = async <T>(path: string, options: NextClawRequestOptions = {}): Promise<T> => {
    const { body, headers, method, signal } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const requestHeaders = {
      ...this.defaultHeaders,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? {})
    };

    try {
      const response = await this.fetchImpl(resolveApiUrl(this.baseUrl, path), {
        method: method ?? "GET",
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ?? controller.signal
      });
      const payload = (await response.json()) as NextClawApiResponse<T> | NextClawApiError;

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
          message: `NextClaw API request timed out after ${this.requestTimeoutMs}ms.`
        });
      }
      throw new NextClawClientError({
        message: error instanceof Error ? error.message : "NextClaw API request failed."
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  private readonly isApiResponse = <T>(value: unknown): value is NextClawApiResponse<T> => {
    return value !== null && typeof value === "object" && "ok" in value;
  };

  private readonly extractApiError = (value: unknown): NextClawApiError => {
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
}
