export type ServiceAppErrorCode =
  | "AUTHORIZATION_REQUIRED"
  | "SERVICE_APP_ACTION_NOT_DECLARED"
  | "SERVICE_APP_ACTION_NOT_FOUND"
  | "SERVICE_APP_INVALID_ACTION"
  | "SERVICE_APP_INVALID_CALLER"
  | "SERVICE_APP_INVALID_MANIFEST"
  | "SERVICE_APP_MANAGED_SOURCE"
  | "SERVICE_APP_NOT_FOUND"
  | "SERVICE_APP_READ_FAILED"
  | "SERVICE_APP_RUNTIME_FAILED";

const SERVICE_APP_ERROR_CODES = new Set<ServiceAppErrorCode>([
  "AUTHORIZATION_REQUIRED",
  "SERVICE_APP_ACTION_NOT_DECLARED",
  "SERVICE_APP_ACTION_NOT_FOUND",
  "SERVICE_APP_INVALID_ACTION",
  "SERVICE_APP_INVALID_CALLER",
  "SERVICE_APP_INVALID_MANIFEST",
  "SERVICE_APP_MANAGED_SOURCE",
  "SERVICE_APP_NOT_FOUND",
  "SERVICE_APP_READ_FAILED",
  "SERVICE_APP_RUNTIME_FAILED",
]);

export class ServiceAppError extends Error {
  constructor(
    readonly code: ServiceAppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceAppError";
  }
}

export const isServiceAppError = (error: unknown): error is ServiceAppError =>
  error instanceof ServiceAppError || (
    typeof error === "object" && error !== null &&
    (error as { name?: unknown }).name === "ServiceAppError" &&
    typeof (error as { message?: unknown }).message === "string" &&
    SERVICE_APP_ERROR_CODES.has((error as { code?: ServiceAppErrorCode }).code as ServiceAppErrorCode)
  );
