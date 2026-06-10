import type { NcpError } from "@nextclaw/ncp";

export function buildSpawnFailureMessage(params: {
  command: string;
  cwd?: string;
  error: Error;
}): string {
  const { command, cwd, error } = params;
  const cwdSuffix = cwd ? ` (cwd: ${cwd})` : "";
  return `[narp-stdio] failed to start stdio runtime command "${command}"${cwdSuffix}: ${error.message}`;
}

export function normalizeRuntimeError(
  error: unknown,
  diagnostics: { stderr?: string } = {},
): NcpError {
  if (isNcpError(error)) {
    return error;
  }
  const message = formatRuntimeErrorMessage(error, diagnostics);
  const lowered = message.toLowerCase();
  return {
    code: lowered.includes("abort") || lowered.includes("cancel")
      ? "abort-error"
      : "runtime-error",
    message,
  };
}

export function isAbortLikeRuntimeError(error: unknown): boolean {
  if (isNcpError(error)) {
    return error.code === "abort-error";
  }
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();
  return lowered.includes("abort") || lowered.includes("cancel");
}

export function formatRuntimeErrorMessage(
  error: unknown,
  diagnostics: { stderr?: string } = {},
): string {
  const message = error instanceof Error ? error.message : String(error);
  const stderr = diagnostics.stderr?.trim();
  return stderr && !message.includes(stderr) ? `${message}. stderr=${stderr}` : message;
}

function isNcpError(value: unknown): value is NcpError {
  if (!value || typeof value !== "object") {
    return false;
  }
  return typeof (value as NcpError).code === "string" && typeof (value as NcpError).message === "string";
}
