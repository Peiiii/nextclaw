import type { StreamEvent } from './transport.types';

type FinalResultSink = (value: unknown) => void;

function parseSseFrame(frame: string): StreamEvent | null {
  const lines = frame.split('\n');
  let name = '';
  const dataLines: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      name = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!name) {
    return null;
  }

  let payload: unknown = undefined;
  const data = dataLines.join('\n');
  if (data) {
    try {
      payload = JSON.parse(data);
    } catch {
      payload = data;
    }
  }

  return { name, payload };
}

function processSseFrame(
  rawFrame: string,
  onEvent: (event: StreamEvent) => void,
  setFinalResult: FinalResultSink
): void {
  const frame = parseSseFrame(rawFrame);
  if (!frame) {
    return;
  }
  if (frame.name === 'final') {
    setFinalResult(frame.payload);
  }
  onEvent(frame);
}

function flushBufferedFrames(
  buffer: string,
  onEvent: (event: StreamEvent) => void,
  setFinalResult: FinalResultSink
): string {
  let remainingBuffer = buffer;
  let boundary = remainingBuffer.indexOf('\n\n');
  while (boundary !== -1) {
    processSseFrame(remainingBuffer.slice(0, boundary), onEvent, setFinalResult);
    remainingBuffer = remainingBuffer.slice(boundary + 2);
    boundary = remainingBuffer.indexOf('\n\n');
  }
  return remainingBuffer;
}

export async function readSseStreamResult<TFinal>(
  response: Response,
  onEvent: (event: StreamEvent) => void
): Promise<TFinal> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('SSE response body unavailable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: unknown = undefined;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      buffer = flushBufferedFrames(buffer, onEvent, (nextValue) => {
        finalResult = nextValue;
      });
    }
    if (buffer.trim()) {
      processSseFrame(buffer, onEvent, (nextValue) => {
        finalResult = nextValue;
      });
    }
  } finally {
    reader.releaseLock();
  }

  return finalResult as TFinal;
}
