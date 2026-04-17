export function parseOpenAiResponsesPayload(rawText: string): Record<string, unknown> {
  const text = rawText.replace(/^\uFEFF/, "").trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const leadingJson = extractLeadingJson(text);
    if (leadingJson) {
      try {
        return JSON.parse(leadingJson) as Record<string, unknown>;
      } catch {
        // continue to SSE fallback
      }
    }

    const sseJson = extractSseJson(text);
    if (sseJson) {
      return unwrapResponsesEnvelope(sseJson);
    }

    throw new Error(`Responses API returned non-JSON payload: ${text.slice(0, 240)}`);
  }
}

export function extractLeadingJson(text: string): string | null {
  const start = findJsonStartIndex(text);
  if (start === -1) {
    return null;
  }
  return sliceBalancedJson(text, start);
}

type JsonScanState = {
  depth: number;
  escaped: boolean;
  inString: boolean;
};

function extractSseJson(text: string): Record<string, unknown> | null {
  const lines = text.split(/\r?\n/);
  let latestJson: Record<string, unknown> | null = null;
  let latestResponse: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      latestJson = parsed;
      if (Array.isArray(parsed.output)) {
        latestResponse = parsed;
        continue;
      }
      const response = parsed.response;
      if (response && typeof response === "object" && !Array.isArray(response)) {
        latestResponse = response as Record<string, unknown>;
      }
    } catch {
      // ignore non-json data frame
    }
  }

  return latestResponse ?? latestJson;
}

function unwrapResponsesEnvelope(payload: Record<string, unknown>): Record<string, unknown> {
  const response = payload.response;
  if (response && typeof response === "object" && !Array.isArray(response)) {
    return response as Record<string, unknown>;
  }
  return payload;
}

function findJsonStartIndex(text: string): number {
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (/\s/.test(ch)) {
      continue;
    }
    return ch === "{" || ch === "[" ? index : -1;
  }
  return -1;
}

function sliceBalancedJson(text: string, start: number): string | null {
  const state: JsonScanState = {
    depth: 0,
    escaped: false,
    inString: false,
  };

  for (let index = start; index < text.length; index += 1) {
    updateJsonScanState(state, text[index]);
    if (state.depth === 0) {
      return text.slice(start, index + 1);
    }
  }

  return null;
}

function updateJsonScanState(state: JsonScanState, ch: string): void {
  if (state.inString) {
    updateQuotedJsonState(state, ch);
    return;
  }

  if (ch === '"') {
    state.inString = true;
    return;
  }
  if (ch === "{" || ch === "[") {
    state.depth += 1;
    return;
  }
  if (ch === "}" || ch === "]") {
    state.depth -= 1;
  }
}

function updateQuotedJsonState(state: JsonScanState, ch: string): void {
  if (state.escaped) {
    state.escaped = false;
    return;
  }
  if (ch === "\\") {
    state.escaped = true;
    return;
  }
  if (ch === '"') {
    state.inString = false;
  }
}
