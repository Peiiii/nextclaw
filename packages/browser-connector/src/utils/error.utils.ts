import {
  BrowserConnectorError,
  type BrowserConnectorCommandFailure,
} from "@/types/cli-output.types.js";

export const toCommandFailure = (
  error: unknown,
): BrowserConnectorCommandFailure => {
  if (error instanceof BrowserConnectorError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        recoverable: error.recoverable,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "UNKNOWN_FAILURE",
      message:
        error instanceof Error
          ? error.message
          : "Unknown browser connector failure.",
      recoverable: false,
    },
  };
};

export const assertString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      `${fieldName} must be a non-empty string.`,
    );
  }

  return value;
};
