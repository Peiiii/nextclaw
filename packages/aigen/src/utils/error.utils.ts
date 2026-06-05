import { AigenError, type AigenCommandFailure } from "@/types/cli-output.types.js";

export const toCommandFailure = (error: unknown): AigenCommandFailure => {
  if (error instanceof AigenError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : "Unknown aigen failure.",
      retryable: false
    }
  };
};

export const assertNever = (value: never): never => {
  throw new AigenError("INVALID_ARGUMENT", `Unsupported command: ${String(value)}`);
};
