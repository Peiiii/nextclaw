import { readString } from "./codex-openai-responses-bridge-shared.js";

const codexResponsesProbeCache = new Map<string, Promise<boolean>>();

function normalizeApiBase(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function readErrorMessage(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const record = value as Record<string, unknown>;
  return readString(record.message) ?? readString(record.error) ?? "";
}

function shouldTreatResponsesProbeFailureAsUnsupported(params: {
  status: number;
  message: string;
}): boolean {
  const normalizedMessage = params.message.trim().toLowerCase();
  if (params.status === 404 || params.status === 405 || params.status === 501) {
    return true;
  }
  if (params.status >= 500) {
    return false;
  }
  return [
    "unsupported model",
    "not support",
    "not supported",
    "unsupported endpoint",
    "unknown url",
    "no route matched",
    "responses api",
  ].some((token) => normalizedMessage.includes(token));
}

async function probeCodexResponsesApiSupport(params: {
  apiBase: string;
  apiKey: string;
  extraHeaders?: Record<string, string> | null;
  model: string;
}): Promise<boolean> {
  const cacheKey = JSON.stringify({
    apiBase: params.apiBase,
    apiKey: params.apiKey,
    extraHeaders: params.extraHeaders ?? {},
    model: params.model,
  });
  const existing = codexResponsesProbeCache.get(cacheKey);
  if (existing) {
    return await existing;
  }

  const probePromise = (async () => {
    const response = await fetch(new URL("responses", normalizeApiBase(params.apiBase)), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
        ...(params.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: params.model,
        input: "ping",
        max_output_tokens: 1,
        stream: false,
      }),
    });
    const rawText = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
    const parsedRecord =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    const message =
      readErrorMessage(parsedRecord?.error) ||
      readErrorMessage(parsed) ||
      rawText.slice(0, 240);
    const responseFailed =
      readString(parsedRecord?.status)?.toLowerCase() === "failed" ||
      Boolean(parsedRecord?.error);
    if (response.ok && !responseFailed) {
      return true;
    }
    return !shouldTreatResponsesProbeFailureAsUnsupported({
      status: response.status,
      message,
    });
  })();

  codexResponsesProbeCache.set(cacheKey, probePromise);
  try {
    return await probePromise;
  } catch (error) {
    codexResponsesProbeCache.delete(cacheKey);
    throw error;
  }
}

export async function resolveCodexResponsesApiSupport(params: {
  capabilitySpec?: {
    supportsResponsesApi?: boolean;
  } | null;
  wireApi?: string | null;
  apiBase: string;
  apiKey: string;
  extraHeaders?: Record<string, string> | null;
  model: string;
}): Promise<boolean> {
  if (params.capabilitySpec?.supportsResponsesApi === true) {
    return true;
  }
  if (params.capabilitySpec?.supportsResponsesApi === false) {
    return false;
  }

  const explicitWireApi = readString(params.wireApi)?.toLowerCase();
  if (explicitWireApi === "chat") {
    return false;
  }
  if (explicitWireApi === "responses") {
    return true;
  }

  return await probeCodexResponsesApiSupport({
    apiBase: params.apiBase,
    apiKey: params.apiKey,
    extraHeaders: params.extraHeaders,
    model: params.model,
  });
}
