import { describe, expect, it, vi } from "vitest";
import type { DirectPromptDispatchExecution } from "@kernel/features/ncp-dispatch/utils/nextclaw-ncp-dispatch.utils.js";
import { NextclawRun } from "./nextclaw-run.manager.js";

function completedExecution(): DirectPromptDispatchExecution {
  const handle = { sessionId: "session", runId: "run", userMessageId: "user", assistantMessageId: "reply" };
  return {
    kind: "agent", agentId: "main", sessionId: "session",
    execution: {
      handle,
      events: (async function* () {})(),
      result: Promise.resolve({ handle, text: "answer", completedMessage: {
        id: "reply", sessionId: "session", role: "assistant", status: "final",
        parts: [{ type: "text", text: "answer" }],
      } }),
      cancel: async () => {}, dispose: () => {},
    },
  };
}

describe("Harness persisted completion", () => {
  it("does not complete or release ownership before persistence finishes", async () => {
    let commit!: () => void;
    const persistence = new Promise<void>((resolve) => { commit = resolve; });
    const settled = vi.fn();
    const run = new NextclawRun(completedExecution(), () => persistence, settled);
    await Promise.resolve();
    expect(run.status).toBe("running");
    expect(settled).not.toHaveBeenCalled();
    commit();
    await expect(run.result()).resolves.toMatchObject({ status: "completed", text: "answer" });
    expect(settled).toHaveBeenCalledOnce();
  });

  it("reports storage failure instead of successful model output", async () => {
    const run = new NextclawRun(completedExecution(), async () => { throw new Error("disk full"); });
    await expect(run.result()).rejects.toMatchObject({ code: "runtime_failure", message: "disk full" });
    expect(run.status).toBe("failed");
  });

  it("waits for failed execution persistence before releasing ownership", async () => {
    const execution = completedExecution();
    if (execution.kind !== "agent") throw new Error("expected agent");
    const executionError = new Error("provider failed");
    execution.execution.result = Promise.reject(executionError);
    let commit!: () => void;
    const persistence = new Promise<void>((resolve) => { commit = resolve; });
    const settled = vi.fn();
    const run = new NextclawRun(execution, () => persistence, settled);
    await Promise.resolve();
    expect(run.status).toBe("running");
    expect(settled).not.toHaveBeenCalled();
    commit();
    await expect(run.result()).rejects.toMatchObject({ code: "runtime_failure", cause: executionError });
    expect(run.status).toBe("failed");
    expect(settled).toHaveBeenCalledOnce();
  });

  it("preserves cancellation and storage errors without hiding failed persistence", async () => {
    const execution = completedExecution();
    if (execution.kind !== "agent") throw new Error("expected agent");
    const cancelled = new DOMException("cancelled", "AbortError");
    const storageError = new Error("storage unavailable");
    execution.execution.result = Promise.reject(cancelled);
    const run = new NextclawRun(execution, async () => { throw storageError; });
    await expect(run.result()).rejects.toMatchObject({
      code: "runtime_failure", cause: { errors: [cancelled, storageError] },
    });
    expect(run.status).toBe("failed");
  });
});
