import assert from "node:assert/strict";
import test from "node:test";
import { readRunStream, streamEvent } from "./bibo-run-stream.utils";

test("runner SSE survives arbitrary byte boundaries and reports the final result", async () => {
  const encoded = new TextEncoder().encode(
    streamEvent("delta", { text: "你" }) + streamEvent("delta", { text: "好" }) + streamEvent("result", { text: "你好", sessionId: "session-1" }),
  );
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull: (controller) => {
      if (offset >= encoded.length) return controller.close();
      controller.enqueue(encoded.slice(offset, offset + 3));
      offset += 3;
    },
  });
  const deltas: string[] = [];
  const result = await readRunStream(new Response(body), (text) => deltas.push(text));
  assert.deepEqual(deltas, ["你", "好"]);
  assert.deepEqual(result, { text: "你好", sessionId: "session-1" });
});

test("runner SSE without a final result cannot be persisted", async () => {
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => { controller.enqueue(new TextEncoder().encode(streamEvent("delta", { text: "partial" }))); controller.close(); },
  });
  await assert.rejects(readRunStream(new Response(body), () => undefined), /without result/);
});
