import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { AgentRunExecutionManager } from "./agent-run-execution.manager.js";
import { runModelRoundWithRecovery, type RuntimeModelRoundRecoveryManagerInput } from "./runtime-model-round-recovery.manager.js";

const spec = { agentId: "main", model: "test", requestedModel: null, runId: "run", runtimeId: "native" };
const marker: NcpEndpointEvent = { type: NcpEventType.MessageSent, payload: { sessionId: "s", message: {
  id: "cp", sessionId: "s", role: "service", status: "final", timestamp: new Date().toISOString(), parts: [], metadata: { nextclaw_timeline_kind: "context_compaction", checkpoint: { status: "compressed" } },
} } };
function input(): RuntimeModelRoundRecoveryManagerInput {
  return {
    spec, sessionId: "s", messageId: "a", modelInput: { model: "test", messages: [{ role: "user", content: "history".repeat(1_000) }] },
    sessionRun: { sessionId: "s", applyEvents: async () => {}, getSnapshot: () => ({ messages: [] }) },
    llmApi: { generate: async function* () { yield* []; } },
    executionManager: new AgentRunExecutionManager({ spec, sessionId: "s", messageId: "a" }),
    streamEncoder: { encode: async function* (source) { yield* []; for await (const _chunk of source) { /* draining propagates transport errors */ } } },
    applyEvent: async (_run, event) => event,
    drainRuntimeEvents: async function* (events) { yield* events; },
    executeToolCall: async () => marker, supportsParallelToolCalls: () => false,
    toRunErrorEvent: error => ({ type: NcpEventType.RunError, payload: { sessionId: "s", error: String(error) } }),
  };
}
async function collect(value: RuntimeModelRoundRecoveryManagerInput) { const events: NcpEndpointEvent[] = []; for await (const event of runModelRoundWithRecovery(value)) events.push(event); return events; }
afterEach(() => vi.useRealTimers());
describe("model recovery bounds", () => {
  it("stops a permanently broken transport after three attempts", async () => {
    vi.useFakeTimers(); const value = input(); let calls = 0;
    value.llmApi.generate = async function* () { yield* []; calls++; throw new Error("Network stream closed before response.completed"); };
    const failure = expect(collect(value)).rejects.toThrow("Network stream closed");
    await vi.runAllTimersAsync(); await failure; expect(calls).toBe(3);
  });
  it("never retries after a tool execution was attempted", async () => {
    const value = input(); let calls = 0; value.hasAttemptedTool = () => true;
    value.llmApi.generate = async function* () { yield* []; calls++; throw new Error("Network stream closed before response.completed"); };
    await expect(collect(value)).rejects.toThrow(); expect(calls).toBe(1);
  });
  it("replays an actual overflow only once after an installed and smaller input", async () => {
    const value = input(); let calls = 0; let compactions = 0;
    value.llmApi.generate = async function* () { yield* []; calls++; throw Object.assign(new Error("maximum context length exceeded"), { code: "context_length_exceeded" }); };
    value.recoverContextOverflow = async function* () { compactions++; yield marker; return { model: "test", messages: [{ role: "user", content: "smaller" }] }; };
    await expect(collect(value)).rejects.toThrow("maximum context"); expect(calls).toBe(2); expect(compactions).toBe(1);
  });
  it.each(["unchanged", "not-installed"])("does not replay a %s compaction", async reason => {
    const value = input(); let calls = 0;
    value.llmApi.generate = async function* () { yield* []; calls++; throw Object.assign(new Error("context overflow"), { code: "context_length_exceeded" }); };
    value.recoverContextOverflow = async function* () { if (reason === "unchanged") yield marker;
      return reason === "unchanged" ? value.modelInput : { model: "test", messages: [] }; };
    await expect(collect(value)).rejects.toThrow("overflow"); expect(calls).toBe(1);
  });
});
