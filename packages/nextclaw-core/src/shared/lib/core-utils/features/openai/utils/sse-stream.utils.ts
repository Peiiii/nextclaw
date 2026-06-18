type OpenAiStreamRequestError = Error & {
  status?: number;
  responseUrl?: string;
  bodyPreview?: string;
  responseText?: string;
};

export type OpenAiSseFrame = {
  data: string;
};

export async function executeOpenAiStreamRequest(params: {
  fetchImpl: typeof fetch;
  url: string;
  apiKey?: string | null;
  extraHeaders?: Record<string, string> | null;
  body: Record<string, unknown>;
  errorLabel: string;
  signal?: AbortSignal;
  streamOptions?: Record<string, unknown>;
}): Promise<Response> {
  const { fetchImpl, url, apiKey, extraHeaders, body, errorLabel, signal, streamOptions } = params;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream, application/json",
    ...(extraHeaders ?? {}),
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const requestBody: Record<string, unknown> = { ...body, stream: true };
  if (streamOptions) {
    requestBody.stream_options = streamOptions;
  }

  const attempt = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!attempt.ok) {
    const text = await attempt.text();
    const preview = text.slice(0, 200);
    const error = new Error(`${errorLabel} failed (${attempt.status}): ${preview}`) as OpenAiStreamRequestError;
    error.status = attempt.status;
    error.responseUrl = url;
    error.bodyPreview = preview;
    error.responseText = text;
    throw error;
  }

  return attempt;
}

export async function* readOpenAiSsePayloads(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) {
    throw new Error("OpenAI-compatible SSE response has no body.");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/event-stream")) {
    yield* parseOpenAiSsePayloadsFromText(await response.text());
    return;
  }

  for await (const frame of readOpenAiSseFrames(response.body)) {
    const payload = parseOpenAiSsePayload(frame.data);
    if (payload) {
      yield payload;
    }
  }
}

export async function* readOpenAiSseFrames(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenAiSseFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const frame = parseOpenAiSseFrame(chunk);
        if (frame) {
          yield frame;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const frame = parseOpenAiSseFrame(buffer);
      if (frame) {
        yield frame;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function* parseOpenAiSsePayloadsFromText(text: string): Generator<Record<string, unknown>> {
  const chunks = text.split(/\r?\n\r?\n/);
  for (const chunk of chunks) {
    const frame = parseOpenAiSseFrame(chunk);
    const payload = frame ? parseOpenAiSsePayload(frame.data) : null;
    if (payload) {
      yield payload;
    }
  }
}

export function parseOpenAiSsePayload(data: string): Record<string, unknown> | null {
  if (!data || data === "[DONE]") {
    return null;
  }
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseOpenAiSseFrame(chunk: string): OpenAiSseFrame | null {
  const lines = chunk.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    data: dataLines.join("\n"),
  };
}
