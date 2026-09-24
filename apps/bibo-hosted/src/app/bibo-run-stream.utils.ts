export type RunResult = { text: string; sessionId: string };

export function streamEvent(event: string, value: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}

export async function readRunStream(response: Response, onDelta: (text: string) => void): Promise<RunResult> {
  if (!response.body) throw new Error("Missing runner stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: RunResult | null = null;
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let boundary: number;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const event = frame.match(/^event: (.+)$/m)?.[1];
        const data = frame.match(/^data: (.+)$/m)?.[1];
        if (!data) continue;
        const payload = JSON.parse(data) as { text?: string; sessionId?: string; error?: string };
        if (event === "delta" && typeof payload.text === "string") onDelta(payload.text);
        if (event === "result" && typeof payload.text === "string" && typeof payload.sessionId === "string") result = { text: payload.text, sessionId: payload.sessionId };
        if (event === "error") throw new Error(payload.error ?? "Runner failed");
      }
      if (done) break;
    }
  } finally { reader.releaseLock(); }
  if (!result) throw new Error("Runner stream ended without result");
  return result;
}
