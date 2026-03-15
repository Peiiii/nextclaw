/**
 * Protocol-level error categories.
 *
 * Uses kebab-case to be consistent with the rest of the NCP type literals
 * (e.g. endpoint kinds, latency profiles).
 */
export type NcpErrorCode =
  | "config-error"
  | "auth-error"
  | "runtime-error"
  | "timeout-error"
  | "abort-error";

/**
 * Structured error payload used on endpoint and stream boundaries.
 *
 * Prefer this over raw `Error` objects when crossing async/transport
 * boundaries so that error metadata survives serialization.
 */
export type NcpError = {
  /** Machine-readable category. */
  code: NcpErrorCode;
  /** Human-readable description intended for developers, not end-users. */
  message: string;
  /** Optional structured context (request ids, field paths, etc.). */
  details?: Record<string, unknown>;
  /** Original cause — preserved for debugging but not guaranteed serializable. */
  cause?: unknown;
};
