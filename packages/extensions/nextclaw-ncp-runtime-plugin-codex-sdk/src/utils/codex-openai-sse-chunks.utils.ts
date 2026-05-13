import {
  readArray,
  readRecord,
  readString,
} from "@codex-plugin-sdk/codex-openai-responses-bridge-shared.utils.js";

export type OpenAiStreamChoiceDelta = Record<string, unknown> & {
  tool_calls?: unknown;
};

export type OpenAiStreamChunk = {
  choices?: Array<{
    delta?: OpenAiStreamChoiceDelta;
    finish_reason?: unknown;
  }>;
  usage?: Record<string, unknown>;
};

export function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return readArray(content)
    .map((entry) => {
      const record = readRecord(entry);
      return readString(record?.text) ?? readString(record?.content) ?? "";
    })
    .join("");
}

export function extractReasoningText(delta: OpenAiStreamChoiceDelta | undefined): string {
  return (
    readString(delta?.reasoning_content) ??
    readString(delta?.reasoning) ??
    readString(delta?.thinking) ??
    ""
  );
}

export async function* readOpenAiSseChunks(
  upstreamResponse: Response,
): AsyncGenerator<OpenAiStreamChunk> {
  const stream = upstreamResponse.body;
  if (!stream) {
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const rawChunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(rawChunk, { stream: true }).replaceAll("\r\n", "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      yield JSON.parse(data) as OpenAiStreamChunk;
    }
  }
}
