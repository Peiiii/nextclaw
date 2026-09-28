import { readQuestions, readShowContent, type BiboQuestion, type BiboShowContent } from "@nextclaw/bibo-client";
import { readRunFailure } from "./diagnostics/bibo-diagnostics.utils";
export type RunResult = { text: string; sessionId: string; questions?: BiboQuestion[]; displayEvents?: BiboShowContent[] };

export function readRunResult(value: RunResult): RunResult {
  if (typeof value.text !== "string" || !value.text || typeof value.sessionId !== "string" || !value.sessionId) throw new Error("Runner returned no savable result");
  const displayEvents = value.displayEvents?.map(readShowContent);
  if (displayEvents?.some((event) => event.sessionId !== value.sessionId)) throw new Error("Display event session mismatch");
  return { text: value.text, sessionId: value.sessionId,
    ...(value.questions === undefined ? {} : { questions: readQuestions(value.questions) }),
    ...(displayEvents?.length ? { displayEvents } : {}) };
}

export function streamEvent(event: string, value: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}

export async function readRunStream(response: Response, onDelta: (text: string) => void): Promise<RunResult> {
  if (!response.body) throw new Error("Missing runner stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: RunResult | null = null;
  const displayEvents: BiboShowContent[] = [];
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
        const payload = JSON.parse(data) as { text?: string; sessionId?: string; questions?: BiboQuestion[]; error?: string };
        if (event === "show-content") displayEvents.push(readShowContent(payload));
        if (event === "delta" && typeof payload.text === "string") onDelta(payload.text);
        if (event === "result" && typeof payload.text === "string" && typeof payload.sessionId === "string") result = { text: payload.text, sessionId: payload.sessionId, questions: payload.questions };
        if (event === "error") throw readRunFailure(payload);
      }
      if (done) break;
    }
  } finally { reader.releaseLock(); }
  if (!result) throw new Error("Runner stream ended without result");
  return readRunResult({ ...result, displayEvents });
}
