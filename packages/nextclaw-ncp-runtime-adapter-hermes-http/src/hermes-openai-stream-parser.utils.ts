import type { OpenAIChatChunk } from "@nextclaw/ncp";

type SseFrame = {
  data: string;
};

export async function* parseHermesOpenAIChatStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenAIChatChunk> {
  for await (const frame of consumeSseFrames(stream)) {
    const payload = frame.data.trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }
    const parsed = JSON.parse(payload) as OpenAIChatChunk;
    yield parsed;
  }
}

async function* consumeSseFrames(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame> {
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
      const drained = drainSseFrames(buffer);
      buffer = drained.rest;
      for (const frame of drained.frames) {
        yield frame;
      }
    }
    buffer += decoder.decode();
    const drained = drainSseFrames(buffer, true);
    for (const frame of drained.frames) {
      yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}

function drainSseFrames(
  rawBuffer: string,
  flush = false,
): { frames: SseFrame[]; rest: string } {
  const parts = rawBuffer.split(/\r?\n\r?\n/u);
  const rest = parts.pop() ?? "";
  const frames = parts
    .map(parseSseFrame)
    .filter((frame): frame is SseFrame => Boolean(frame));

  if (!flush || !rest.trim()) {
    return { frames, rest };
  }

  const finalFrame = parseSseFrame(rest);
  return {
    frames: finalFrame ? [...frames, finalFrame] : frames,
    rest: "",
  };
}

function parseSseFrame(frameText: string): SseFrame | null {
  const dataLines: string[] = [];
  for (const rawLine of frameText.split(/\r?\n/u)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":") || !line.startsWith("data:")) {
      continue;
    }
    dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    data: dataLines.join("\n"),
  };
}
