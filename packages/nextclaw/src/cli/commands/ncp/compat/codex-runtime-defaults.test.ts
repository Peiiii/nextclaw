import { describe, expect, it, vi } from "vitest";
import { CodexSdkNcpAgentRuntime } from "../../../../../../extensions/nextclaw-ncp-runtime-codex-sdk/src/index.js";

const setRuntimeGetCodex = (
  runtime: CodexSdkNcpAgentRuntime,
  getCodex: () => Promise<{
    startThread: ReturnType<typeof vi.fn>;
    resumeThread: ReturnType<typeof vi.fn>;
  }>,
): void => {
  Reflect.set(runtime as object, "getCodex", getCodex);
};

const resolveRuntimeThread = async (runtime: CodexSdkNcpAgentRuntime): Promise<unknown> => {
  const resolveThread = Reflect.get(runtime as object, "resolveThread");
  if (typeof resolveThread !== "function") {
    throw new Error("resolveThread is not available");
  }
  return await Reflect.apply(resolveThread, runtime, []);
};

describe("CodexSdkNcpAgentRuntime", () => {
  it("defaults skipGitRepoCheck to true when building thread options", async () => {
    const startThread = vi.fn(() => ({}));
    const runtime = new CodexSdkNcpAgentRuntime({
      sessionId: "session-1",
      apiKey: "test-key",
    });

    setRuntimeGetCodex(runtime, async () => ({
      startThread,
      resumeThread: vi.fn(),
    }));

    await resolveRuntimeThread(runtime);

    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        skipGitRepoCheck: true,
      }),
    );
  });

  it("preserves an explicit model while still enabling skipGitRepoCheck", async () => {
    const startThread = vi.fn(() => ({}));
    const runtime = new CodexSdkNcpAgentRuntime({
      sessionId: "session-2",
      apiKey: "test-key",
      model: "gpt-5-codex",
      threadOptions: {
        skipGitRepoCheck: false,
      },
    });

    setRuntimeGetCodex(runtime, async () => ({
      startThread,
      resumeThread: vi.fn(),
    }));

    await resolveRuntimeThread(runtime);

    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-codex",
        skipGitRepoCheck: false,
      }),
    );
  });
});
