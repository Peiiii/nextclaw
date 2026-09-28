import assert from "node:assert/strict";
import test from "node:test";
import { logDiagnostic, readModelRequest, MAX_MODEL_REQUEST_BYTES, readTrace, runFailure } from "./bibo-diagnostics.utils";
import { parseLogOptions, projectLog, queryLogs } from "../../../scripts/diagnostics/bibo-logs.controller";
import { readRunStream, streamEvent } from "@/app/bibo-run-stream.utils";

test("model transport accepts multilingual history above the old cap", async () => {
  const raw = JSON.stringify({ messages: [{ role: "user", content: "历史上下文".repeat(20000) }] });
  const result = await readModelRequest(new Request("https://bibo.test/model", { method: "POST", body: raw }));
  assert.ok(result.bytes > 128 * 1024);
  assert.equal(result.raw, raw);
});

test("chunked oversized body is stopped without relying on Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull: (controller) => { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel: () => { cancelled = true; } });
  await assert.rejects(readModelRequest(new Request("https://bibo.test/model", { method: "POST", body, duplex: "half" } as RequestInit)), { code: "MODEL_INPUT_TOO_LARGE", status: 413 });
  assert.equal(cancelled, true);
  await assert.rejects(readModelRequest(new Request("https://bibo.test/model", { method: "POST", headers: { "content-length": String(MAX_MODEL_REQUEST_BYTES + 1) } })), { status: 413 });
});

test("structured logs drop extra fields and public errors never echo raw upstream content", () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => { lines.push(line); };
  try {
    const fields = { runId: "run-1", sessionId: "session-1", token: "secret-token", message: "private-user-message", status: 413 };
    logDiagnostic("model", "model.rejected", fields, "error");
  } finally { console.error = original; }
  assert.ok(!lines[0]!.includes("secret-token"));
  assert.ok(!lines[0]!.includes("private-user-message"));
  assert.equal(JSON.parse(lines[0]!).sessionId, "session-1");
  assert.equal(runFailure(new Error("Chat Completions API failed (413): private-user-message secret-token")).code, "MODEL_INPUT_TOO_LARGE");
  assert.ok(!runFailure(new Error("private-user-message secret-token")).message.includes("secret-token"));
  assert.notEqual(readTrace(new Headers({ "x-bibo-run-id": "invalid id" })).runId, "invalid id");
});

test("runner SSE carries known failure code through HTTP 200", async () => {
  const response = new Response(streamEvent("error", { code: "MODEL_INPUT_TOO_LARGE", status: 413, error: "private detail" }));
  await assert.rejects(readRunStream(response, () => undefined), { code: "MODEL_INPUT_TOO_LARGE", status: 413 });
});

test("historical query supports bounded ranges and projects only diagnostics", () => {
  const now = Date.parse("2026-09-28T08:00:00Z");
  assert.deepEqual(parseLogOptions(["--", "--since", "24h", "--session", "session-1", "--json"], now), { since: now - 86400000, until: now, session: "session-1", json: true });
  assert.throws(() => parseLogOptions(["--since", "8d"], now), /7 days/);
  const event = projectLog({ timestamp: now, source: { message: JSON.stringify({ schema: "bibo.diagnostic/v1", runId: "run-1", sessionId: "session-1", token: "secret", content: "private" }) } });
  assert.equal(event.runId, "run-1");
  assert.equal(event.token, undefined);
  assert.equal(projectLog({ timestamp: now, source: { message: 'bibo-runner-error Chat Completions API failed (413): private' } }).errorCode, "MODEL_INPUT_TOO_LARGE");
});

test("historical query returns correlated Worker and Container events while marking sampled results", async () => {
  const requests: Array<{ parameters: { datasets: string[]; filters: Array<{ key: string; value: string }> } }> = [];
  const api = async (_path: string, body?: unknown) => {
    const query = body as { parameters: { datasets: string[]; filters: Array<{ key: string; value: string }> } };
    requests.push(query);
    const container = query.parameters.datasets[0] === "containers";
    return { statistics: { abr_level: 1 }, events: { events: [{
      timestamp: container ? 2 : 1,
      $metadata: { service: container ? "app-1" : "bibo-hosted" },
      source: { schema: "bibo.diagnostic/v1", event: container ? "run.started" : "run.finished", runId: "run-1", sessionId: "session-1" },
    }] } };
  };
  const result = await queryLogs(api, { since: 0, until: 3, session: "session-1", run: "run-1", json: true }, "app-1");
  assert.equal(result.samplingLevel, 1);
  assert.deepEqual(result.records.map((record) => record.event), ["run.finished", "run.started"]);
  assert.deepEqual(requests.map((request) => request.parameters.filters.map((filter) => filter.key)), [
    ["$metadata.service", "sessionId", "runId"], ["$metadata.service", "sessionId", "runId"],
  ]);
});
