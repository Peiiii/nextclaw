import { describe, expect, it } from 'vitest';
import { readSseStreamResult } from './sse-stream.utils';

function createSseResponse(frames: string[]): Response {
  const payload = new TextEncoder().encode(frames.join(''));
  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(payload);
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8'
    }
  });
}

function encodeFrame(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

describe('readSseStreamResult', () => {
  it('preserves final frames for callers while still resolving with the final payload', async () => {
    const events: Array<{ name: string; payload?: unknown }> = [];
    const response = createSseResponse([
      encodeFrame('ncp-event', { type: 'message.text-delta', payload: { delta: 'hello' } }),
      encodeFrame('final', { sessionId: 's1', reply: 'hello' })
    ]);

    const result = await readSseStreamResult(response, (event) => {
      events.push(event);
    });

    expect(result).toEqual({ sessionId: 's1', reply: 'hello' });
    expect(events.map((event) => event.name)).toEqual(['ncp-event', 'final']);
  });

  it('allows passthrough SSE streams to end without a final frame', async () => {
    const events: Array<{ name: string; payload?: unknown }> = [];
    const response = createSseResponse([
      encodeFrame('ncp-event', { type: 'message.text-delta', payload: { delta: 'hello' } }),
      encodeFrame('ncp-event', { type: 'run.finished', payload: { sessionId: 's1' } })
    ]);

    const result = await readSseStreamResult(response, (event) => {
      events.push(event);
    });

    expect(result).toBeUndefined();
    expect(events.map((event) => event.name)).toEqual(['ncp-event', 'ncp-event']);
  });
});
