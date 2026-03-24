import type { IncomingMessage, ServerResponse } from "node:http";

export type RequestBodyLimitErrorCode =
  | "PAYLOAD_TOO_LARGE"
  | "REQUEST_BODY_TIMEOUT"
  | "CONNECTION_CLOSED";

class RequestBodyLimitError extends Error {
  readonly code: RequestBodyLimitErrorCode;
  readonly statusCode: number;

  constructor(code: RequestBodyLimitErrorCode) {
    super(code);
    this.name = "RequestBodyLimitError";
    this.code = code;
    this.statusCode = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "REQUEST_BODY_TIMEOUT" ? 408 : 400;
  }
}

function requestBodyErrorToText(code: RequestBodyLimitErrorCode): string {
  switch (code) {
    case "PAYLOAD_TOO_LARGE":
      return "Payload too large";
    case "REQUEST_BODY_TIMEOUT":
      return "Request body timeout";
    default:
      return "Connection closed";
  }
}

function parseContentLengthHeader(req: IncomingMessage): number | null {
  const header = req.headers["content-length"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readRequestBodyWithLimit(
  req: IncomingMessage,
  options: { maxBytes: number; timeoutMs?: number; encoding?: BufferEncoding },
): Promise<string> {
  const maxBytes = Math.max(1, Math.floor(options.maxBytes));
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? Math.floor(options.timeoutMs)
      : 30_000;
  const encoding = options.encoding ?? "utf-8";

  const declaredLength = parseContentLengthHeader(req);
  if (declaredLength !== null && declaredLength > maxBytes) {
    throw new RequestBodyLimitError("PAYLOAD_TOO_LARGE");
  }

  return await new Promise((resolve, reject) => {
    let done = false;
    let ended = false;
    let totalBytes = 0;
    const chunks: Buffer[] = [];

    const finish = (cb: () => void) => {
      if (done) {
        return;
      }
      done = true;
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
      req.removeListener("close", onClose);
      clearTimeout(timer);
      cb();
    };

    const fail = (error: Error) => finish(() => reject(error));

    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        if (!req.destroyed) {
          req.destroy();
        }
        fail(new RequestBodyLimitError("PAYLOAD_TOO_LARGE"));
        return;
      }
      chunks.push(buffer);
    };

    const onEnd = () => {
      ended = true;
      finish(() => resolve(Buffer.concat(chunks).toString(encoding)));
    };
    const onError = (error: Error) => fail(error);
    const onClose = () => {
      if (!done && !ended) {
        fail(new RequestBodyLimitError("CONNECTION_CLOSED"));
      }
    };

    const timer = setTimeout(() => {
      if (!req.destroyed) {
        req.destroy();
      }
      fail(new RequestBodyLimitError("REQUEST_BODY_TIMEOUT"));
    }, timeoutMs);

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("close", onClose);
  });
}

export async function readJsonBodyWithLimit(
  req: IncomingMessage,
  options: { maxBytes: number; timeoutMs?: number; emptyObjectOnEmpty?: boolean },
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; error: string; code: RequestBodyLimitErrorCode | "INVALID_JSON" }
> {
  try {
    const raw = await readRequestBodyWithLimit(req, options);
    const trimmed = raw.trim();
    if (!trimmed) {
      if (options.emptyObjectOnEmpty === false) {
        return { ok: false, code: "INVALID_JSON", error: "empty payload" };
      }
      return { ok: true, value: {} };
    }
    try {
      return { ok: true, value: JSON.parse(trimmed) as unknown };
    } catch (error) {
      return {
        ok: false,
        code: "INVALID_JSON",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } catch (error) {
    if (error instanceof RequestBodyLimitError) {
      return { ok: false, code: error.code, error: requestBodyErrorToText(error.code) };
    }
    return {
      ok: false,
      code: "INVALID_JSON",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function installRequestBodyLimitGuard(
  req: IncomingMessage,
  res: ServerResponse,
  options: { maxBytes: number; timeoutMs?: number; responseFormat?: "json" | "text" },
) {
  const maxBytes = Math.max(1, Math.floor(options.maxBytes));
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? Math.floor(options.timeoutMs)
      : 30_000;
  const responseFormat = options.responseFormat ?? "json";

  let tripped = false;
  let code: RequestBodyLimitErrorCode | null = null;
  let done = false;
  let ended = false;
  let totalBytes = 0;

  const finish = () => {
    if (done) {
      return;
    }
    done = true;
    req.removeListener("data", onData);
    req.removeListener("end", onEnd);
    req.removeListener("close", onClose);
    req.removeListener("error", onError);
    clearTimeout(timer);
  };

  const respond = (error: RequestBodyLimitError) => {
    if (res.headersSent) {
      return;
    }
    const text = requestBodyErrorToText(error.code);
    res.statusCode = error.statusCode;
    if (responseFormat === "text") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(text);
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: text }));
  };

  const trip = (error: RequestBodyLimitError) => {
    if (tripped) {
      return;
    }
    tripped = true;
    code = error.code;
    finish();
    respond(error);
    if (!req.destroyed) {
      req.destroy();
    }
  };

  const onData = (chunk: Buffer | string) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      trip(new RequestBodyLimitError("PAYLOAD_TOO_LARGE"));
    }
  };
  const onEnd = () => {
    ended = true;
    finish();
  };
  const onClose = () => {
    if (!ended) {
      finish();
    }
  };
  const onError = () => finish();
  const timer = setTimeout(() => trip(new RequestBodyLimitError("REQUEST_BODY_TIMEOUT")), timeoutMs);

  req.on("data", onData);
  req.on("end", onEnd);
  req.on("close", onClose);
  req.on("error", onError);

  const declaredLength = parseContentLengthHeader(req);
  if (declaredLength !== null && declaredLength > maxBytes) {
    trip(new RequestBodyLimitError("PAYLOAD_TOO_LARGE"));
  }

  return {
    dispose: finish,
    isTripped: () => tripped,
    code: () => code,
  };
}
