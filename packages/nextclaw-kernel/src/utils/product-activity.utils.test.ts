import { describe, expect, it, vi } from "vitest";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import {
  recordProductActivityBestEffort,
  resolveHumanProductActivitySource,
} from "./product-activity.utils.js";

function createRequest(overrides: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    message: {
      id: "message-1",
      role: "user",
      content: "private content must not enter analytics",
    },
    ...overrides,
  } as AgentRunRequest;
}

describe("product activity classification", () => {
  it("classifies direct and channel requests", () => {
    expect(resolveHumanProductActivitySource(createRequest())).toBe("direct");
    expect(
      resolveHumanProductActivitySource(createRequest({ channel: "qq" })),
    ).toBe("channel");
  });

  it("excludes cron and child-session runs", () => {
    expect(
      resolveHumanProductActivitySource(createRequest({
        metadata: { session_origin: "cron" },
      })),
    ).toBeNull();
    expect(
      resolveHumanProductActivitySource(createRequest({
        metadata: {
          session_materialization: {
            kind: "child",
            parentSessionId: "parent",
          },
        },
      })),
    ).toBeNull();
  });

  it("swallows synchronous and asynchronous sink failures", async () => {
    expect(() => recordProductActivityBestEffort(
      { record: () => { throw new Error("sync"); } },
      { kind: "intent_accepted", occurredAt: new Date().toISOString(), source: "direct" },
    )).not.toThrow();

    const unhandled = vi.fn();
    process.once("unhandledRejection", unhandled);
    recordProductActivityBestEffort(
      { record: async () => { throw new Error("async"); } },
      { kind: "run_succeeded", occurredAt: new Date().toISOString(), source: "channel" },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).not.toHaveBeenCalled();
  });
});
