import type {
  DiagnosticFactValue,
  DiagnosticOutcome,
} from "../configs/ingress-keys.config.js";

export type DiagnosticErrorClassification = {
  outcome: Extract<DiagnosticOutcome, "cancelled" | "failed">;
  reasonCode: string;
  providerCode?: string;
  facts?: Record<string, DiagnosticFactValue>;
};

type AbortSignalLike = {
  aborted?: boolean;
};

const CANCEL_NAMES = new Set(["aborterror", "cancelederror", "cancellederror"]);
const CANCEL_CODES = new Set(["abort_err", "err_canceled", "err_cancelled"]);
const TIMEOUT_CODES = new Set([
  "etimedout",
  "err_socket_timeout",
  "und_err_connect_timeout",
  "und_err_headers_timeout",
  "und_err_body_timeout",
]);
const DNS_CODES = new Set(["enotfound", "eai_again"]);
const CONNECTION_REFUSED_CODES = new Set(["econnrefused"]);
const CONNECTION_RESET_CODES = new Set(["econnreset", "epipe"]);
const NETWORK_UNREACHABLE_CODES = new Set(["enetunreach", "ehostunreach"]);

function readErrorField(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  return (error as Record<string, unknown>)[key];
}

function readNormalizedString(error: unknown, key: string): string | undefined {
  let current = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 3 && current && !seen.has(current); depth += 1) {
    seen.add(current);
    const value = readErrorField(current, key);
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized) {
        return normalized;
      }
    }
    current = readErrorField(current, "cause");
  }
  return undefined;
}

function readHttpStatus(error: unknown, depth = 0): number | undefined {
  if (depth > 2) {
    return undefined;
  }
  for (const key of ["status", "statusCode"]) {
    const value = readErrorField(error, key);
    if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
      return value;
    }
  }
  const response = readErrorField(error, "response");
  if (response && response !== error) {
    const responseStatus = readHttpStatus(response, depth + 1);
    if (responseStatus !== undefined) {
      return responseStatus;
    }
  }
  const cause = readErrorField(error, "cause");
  return cause === error ? undefined : readHttpStatus(cause, depth + 1);
}

function isTlsCode(code: string | undefined): boolean {
  return Boolean(code && (
    code.startsWith("err_tls_")
    || code.startsWith("cert_")
    || code.includes("certificate")
  ));
}

function classifyHttpStatus(status: number): string {
  if (status === 401) return "http_unauthenticated";
  if (status === 403) return "http_forbidden";
  if (status === 404) return "http_not_found";
  if (status === 408 || status === 504) return "network_timeout";
  if (status === 409) return "http_conflict";
  if (status === 429) return "http_rate_limited";
  if (status >= 500) return "http_remote_unavailable";
  if (status >= 400) return "http_request_rejected";
  return "http_unexpected_status";
}

export function classifyDiagnosticError(
  error: unknown,
  signal?: AbortSignalLike,
): DiagnosticErrorClassification {
  const name = readNormalizedString(error, "name");
  const code = readNormalizedString(error, "code");
  const providerCode = code && /^[a-z0-9][a-z0-9._-]{0,95}$/.test(code)
    ? code
    : undefined;

  if (signal?.aborted || CANCEL_NAMES.has(name ?? "") || CANCEL_CODES.has(code ?? "")) {
    return {
      outcome: "cancelled",
      reasonCode: "operation_cancelled",
      ...(providerCode ? { providerCode } : {}),
    };
  }
  if (TIMEOUT_CODES.has(code ?? "") || name === "timeouterror") {
    return { outcome: "failed", reasonCode: "network_timeout", ...(providerCode ? { providerCode } : {}) };
  }
  if (DNS_CODES.has(code ?? "")) {
    return { outcome: "failed", reasonCode: "network_dns_failure", ...(providerCode ? { providerCode } : {}) };
  }
  if (CONNECTION_REFUSED_CODES.has(code ?? "")) {
    return { outcome: "failed", reasonCode: "network_connection_refused", ...(providerCode ? { providerCode } : {}) };
  }
  if (CONNECTION_RESET_CODES.has(code ?? "")) {
    return { outcome: "failed", reasonCode: "network_connection_reset", ...(providerCode ? { providerCode } : {}) };
  }
  if (NETWORK_UNREACHABLE_CODES.has(code ?? "")) {
    return { outcome: "failed", reasonCode: "network_unreachable", ...(providerCode ? { providerCode } : {}) };
  }
  if (isTlsCode(code)) {
    return { outcome: "failed", reasonCode: "network_tls_failure", ...(providerCode ? { providerCode } : {}) };
  }

  const httpStatus = readHttpStatus(error);
  if (httpStatus !== undefined) {
    return {
      outcome: "failed",
      reasonCode: classifyHttpStatus(httpStatus),
      ...(providerCode ? { providerCode } : {}),
      facts: { httpStatus },
    };
  }

  return {
    outcome: "failed",
    reasonCode: error instanceof Error ? "unexpected_error" : "non_error_thrown",
    ...(providerCode ? { providerCode } : {}),
  };
}
