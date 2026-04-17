import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { StdioRuntimeNcpAgentRuntime } from "./index.js";

const SLOW_CANCEL_FIXTURE_PATH = join(
  import.meta.dirname,
  "test-fixtures",
  "slow-cancel-agent.mjs",
);

function createAbortRuntime(): StdioRuntimeNcpAgentRuntime {
  return new StdioRuntimeNcpAgentRuntime({
    sessionId: "session-stdio-manual-abort",
    wireDialect: "acp",
    processScope: "per-session",
    command: process.execPath,
    args: [SLOW_CANCEL_FIXTURE_PATH],
    startupTimeoutMs: 10_000,
    probeTimeoutMs: 3_000,
    requestTimeoutMs: 30_000,
  });
}

function createAbortInput() {
  return {
    sessionId: "session-stdio-manual-abort",
    messages: [
      {
        id: "user-manual-abort",
        sessionId: "session-stdio-manual-abort",
        role: "user" as const,
        status: "final" as const,
        timestamp: "2026-04-17T00:00:00.000Z",
        parts: [{ type: "text" as const, text: "abort me" }],
      },
    ],
  };
}

describe("StdioRuntimeNcpAgentRuntime manual abort", () => {
  it("treats manual abort as cancellation instead of emitting runtime errors", async () => {
    const runtime = createAbortRuntime();
    const controller = new AbortController();
    const events: NcpEndpointEvent[] = [];

    for await (const event of runtime.run(createAbortInput(), {
      signal: controller.signal,
    })) {
      events.push(event);
      if (event.type === NcpEventType.MessageTextDelta) {
        controller.abort();
      }
    }

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageAccepted,
      NcpEventType.RunStarted,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
    ]);
    expect(events.some((event) => event.type === NcpEventType.MessageFailed)).toBe(false);
    expect(events.some((event) => event.type === NcpEventType.RunError)).toBe(false);
  });
});
