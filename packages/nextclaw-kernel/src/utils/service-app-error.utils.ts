export type ServiceAppErrorCode =
  | "AUTHORIZATION_REQUIRED"
  | "DOCUMENT_SCOPE_NOT_GRANTED"
  | "DOCUMENT_SCOPE_MODE_INSUFFICIENT"
  | "DOCUMENT_SCOPE_UNAVAILABLE"
  | "SERVICE_APP_ACTION_NOT_DECLARED"
  | "SERVICE_APP_ACTION_NOT_FOUND"
  | "SERVICE_APP_INVALID_ACTION"
  | "SERVICE_APP_INVALID_CALLER"
  | "SERVICE_APP_INVALID_MANIFEST"
  | "SERVICE_APP_MANAGED_SOURCE"
  | "SERVICE_APP_JOB_CONFLICT"
  | "SERVICE_APP_JOB_CURSOR_INVALID"
  | "SERVICE_APP_JOB_EVENT_LIMIT"
  | "SERVICE_APP_JOB_NOT_FOUND"
  | "SERVICE_APP_JOB_TERMINAL"
  | "SERVICE_APP_RESIDENT_EVENT_NOT_FOUND"
  | "SERVICE_APP_RESIDENT_EVENT_CONFLICT"
  | "SERVICE_APP_RESIDENT_EVENT_LEASE_INVALID"
  | "SERVICE_APP_RESIDENT_INBOX_FROZEN"
  | "SERVICE_APP_NOT_FOUND"
  | "SERVICE_APP_READ_FAILED"
  | "SERVICE_APP_RUNTIME_FAILED"
  | "STREAM_BACKPRESSURE_TIMEOUT"
  | "STREAM_CURSOR_EXPIRED"
  | "WASI_ABI_VERSION_MISMATCH"
  | "WASI_CAPABILITY_DENIED"
  | "WASI_COMPONENT_FAILED"
  | "WASI_COMPONENT_TRAP"
  | "WASI_GUEST_EXPORT_MISSING"
  | "WASI_INPUT_SCHEMA_MISMATCH";

const SERVICE_APP_ERROR_CODES = new Set<ServiceAppErrorCode>([
  "AUTHORIZATION_REQUIRED",
  "DOCUMENT_SCOPE_NOT_GRANTED",
  "DOCUMENT_SCOPE_MODE_INSUFFICIENT",
  "DOCUMENT_SCOPE_UNAVAILABLE",
  "SERVICE_APP_ACTION_NOT_DECLARED",
  "SERVICE_APP_ACTION_NOT_FOUND",
  "SERVICE_APP_INVALID_ACTION",
  "SERVICE_APP_INVALID_CALLER",
  "SERVICE_APP_INVALID_MANIFEST",
  "SERVICE_APP_MANAGED_SOURCE",
  "SERVICE_APP_JOB_CONFLICT",
  "SERVICE_APP_JOB_CURSOR_INVALID",
  "SERVICE_APP_JOB_EVENT_LIMIT",
  "SERVICE_APP_JOB_NOT_FOUND",
  "SERVICE_APP_JOB_TERMINAL",
  "SERVICE_APP_RESIDENT_EVENT_NOT_FOUND",
  "SERVICE_APP_RESIDENT_EVENT_CONFLICT",
  "SERVICE_APP_RESIDENT_EVENT_LEASE_INVALID",
  "SERVICE_APP_RESIDENT_INBOX_FROZEN",
  "SERVICE_APP_NOT_FOUND",
  "SERVICE_APP_READ_FAILED",
  "SERVICE_APP_RUNTIME_FAILED",
  "STREAM_BACKPRESSURE_TIMEOUT",
  "STREAM_CURSOR_EXPIRED",
  "WASI_ABI_VERSION_MISMATCH",
  "WASI_CAPABILITY_DENIED",
  "WASI_COMPONENT_FAILED",
  "WASI_COMPONENT_TRAP",
  "WASI_GUEST_EXPORT_MISSING",
  "WASI_INPUT_SCHEMA_MISMATCH",
]);

export class ServiceAppError extends Error {
  constructor(
    readonly code: ServiceAppErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceAppError";
  }
}

export const isServiceAppError = (error: unknown): error is ServiceAppError =>
  error instanceof ServiceAppError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "ServiceAppError" &&
    typeof (error as { message?: unknown }).message === "string" &&
    SERVICE_APP_ERROR_CODES.has(
      (error as { code?: ServiceAppErrorCode }).code as ServiceAppErrorCode,
    ));

export const toServiceAppRuntimeError = (
  error: unknown,
  appId: string,
  actionName: string,
): ServiceAppError => {
  if (isPortableWasiError(error)) {
    return new ServiceAppError(error.code, error.message, error.details);
  }
  return new ServiceAppError(
    "SERVICE_APP_RUNTIME_FAILED",
    `Service App ${appId} action ${actionName} failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
};

const isPortableWasiError = (
  error: unknown,
): error is {
  code: Extract<ServiceAppErrorCode, `WASI_${string}`>;
  details?: Record<string, unknown>;
  message: string;
} => {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: ServiceAppErrorCode;
    message?: unknown;
    name?: unknown;
  };
  return (
    candidate.name === "PortableServiceRunnerError" &&
    typeof candidate.message === "string" &&
    typeof candidate.code === "string" &&
    candidate.code.startsWith("WASI_") &&
    SERVICE_APP_ERROR_CODES.has(candidate.code)
  );
};
