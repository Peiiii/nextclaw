export type SseFrame = {
  event: string;
  data: string;
};

export function parseSseFrame(frameText: string): SseFrame | null {
  const lines = frameText.split(/\r?\n/);
  let eventName = "message";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
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
    event: eventName,
    data: dataLines.join("\n"),
  };
}

export async function* consumeSseStream(
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
      const { frames, rest } = drainFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        yield frame;
      }
    }
    buffer += decoder.decode();
    const { frames } = drainFrames(buffer, true);
    for (const frame of frames) {
      yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}

function drainFrames(rawBuffer: string, flush = false): { frames: SseFrame[]; rest: string } {
  const parts = rawBuffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? "";
  const frames: SseFrame[] = [];
  for (const part of parts) {
    const frame = parseSseFrame(part);
    if (frame) {
      frames.push(frame);
    }
  }
  if (flush && rest.trim()) {
    const frame = parseSseFrame(rest);
    if (frame) {
      frames.push(frame);
    }
    return { frames, rest: "" };
  }
  return { frames, rest };
}
