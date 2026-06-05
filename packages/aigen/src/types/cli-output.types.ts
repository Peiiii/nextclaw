export type AigenErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "PROVIDER_NOT_FOUND"
  | "MODEL_NOT_FOUND"
  | "SECRET_NOT_FOUND"
  | "MISSING_API_KEY"
  | "PROVIDER_RUNTIME_NOT_FOUND"
  | "PROVIDER_REQUEST_FAILED"
  | "UNSUPPORTED_PARAMETER"
  | "INVALID_ARGUMENT"
  | "FILE_WRITE_FAILED";

export type AigenCommandError = {
  code: AigenErrorCode;
  message: string;
  retryable?: boolean;
};

export type AigenCommandSuccess<TData extends Record<string, unknown> = Record<string, unknown>> = {
  ok: true;
} & TData;

export type AigenCommandFailure = {
  ok: false;
  error: AigenCommandError;
};

export type AigenCommandOutput<TData extends Record<string, unknown> = Record<string, unknown>> =
  | AigenCommandSuccess<TData>
  | AigenCommandFailure;

export class AigenError extends Error {
  readonly code: AigenErrorCode;
  readonly retryable: boolean;

  constructor(code: AigenErrorCode, message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "AigenError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}
