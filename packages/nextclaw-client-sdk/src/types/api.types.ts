export type NextClawApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type NextClawApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: NextClawApiError };
