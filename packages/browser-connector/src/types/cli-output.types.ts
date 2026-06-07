export type BrowserConnectorErrorCode =
  | "INVALID_ARGUMENT"
  | "CONFIG_INVALID"
  | "HOST_UNAVAILABLE"
  | "EXTENSION_DISCONNECTED"
  | "IPC_REQUEST_FAILED"
  | "LEASE_NOT_FOUND"
  | "UNSUPPORTED_COMMAND"
  | "PAGE_SCRIPT_FAILED"
  | "PAGE_SCRIPT_RESULT_MISSING"
  | "TAB_NOT_FOUND"
  | "NAVIGATION_TIMEOUT"
  | "ACTION_REQUIRES_CONFIRMATION"
  | "UNSUPPORTED_PLATFORM"
  | "FILE_WRITE_FAILED"
  | "NATIVE_HOST_NOT_INSTALLED"
  | "UNKNOWN_FAILURE";

export type BrowserConnectorCommandError = {
  code: BrowserConnectorErrorCode;
  message: string;
  recoverable: boolean;
};

export type BrowserConnectorCommandSuccess<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = {
  ok: true;
} & TData;

export type BrowserConnectorCommandFailure = {
  ok: false;
  error: BrowserConnectorCommandError;
};

export type BrowserConnectorCommandOutput<
  TData extends Record<string, unknown> = Record<string, unknown>,
> =
  | BrowserConnectorCommandSuccess<TData>
  | BrowserConnectorCommandFailure;

export class BrowserConnectorError extends Error {
  readonly code: BrowserConnectorErrorCode;
  readonly recoverable: boolean;

  constructor(
    code: BrowserConnectorErrorCode,
    message: string,
    options?: { recoverable?: boolean },
  ) {
    super(message);
    this.name = "BrowserConnectorError";
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
  }
}
