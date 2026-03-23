const TERMINAL_REMOTE_ERROR_PATTERNS = [
  /invalid or expired token/i,
  /missing bearer token/i,
  /token expired/i,
  /token is invalid/i,
  /run "nextclaw login"/i
];

export function isTerminalRemoteConnectorError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TERMINAL_REMOTE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
