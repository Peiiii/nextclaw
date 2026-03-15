import type { NcpErrorCode } from "@nextclaw/ncp";

/**
 * Throwable form of protocol error for exception-based control flows.
 */
export class NcpErrorException extends Error {
  readonly code: NcpErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: NcpErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NcpErrorException";
    this.code = code;
    this.details = details;
  }
}
