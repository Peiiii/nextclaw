import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agentRunClientMock: vi.fn(),
  dispatchPromptOverNcpMock: vi.fn(),
  printAgentResponseMock: vi.fn(),
  promptMock: vi.fn(),
  getDataDirMock: vi.fn()
}));

vi.mock("@nextclaw/core", () => ({
  getDataDir: mocks.getDataDirMock
}));

vi.mock("@nextclaw/kernel", () => ({
  AgentRunClient: mocks.agentRunClientMock,
  dispatchPromptOverNcp: mocks.dispatchPromptOverNcpMock
}));

vi.mock("@nextclaw-service/utils/cli.utils.js", () => ({
  printAgentResponse: mocks.printAgentResponseMock,
  prompt: mocks.promptMock
}));

import { runCliAgentCommand } from "@nextclaw-service/utils/cli-agent-runner.utils.js";

describe("runCliAgentCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    mocks.agentRunClientMock.mockImplementation(function AgentRunClientMock(
      this: { options: unknown },
      options: unknown
    ) {
      this.options = options;
    });
  });

  it("prints one-shot run errors without leaking a stack trace", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const kernel = {
      extensions: { load: vi.fn() },
      start: vi.fn(),
      dispose: vi.fn(),
      eventBus: {},
      ingress: {}
    };
    mocks.dispatchPromptOverNcpMock.mockRejectedValue(
      new Error("401 Incorrect API key provided.")
    );

    await runCliAgentCommand({
      logo: "NextClaw",
      opts: { message: "hello" },
      config: {},
      kernel
    } as never);

    expect(errorSpy).toHaveBeenCalledWith("Error: 401 Incorrect API key provided.");
    expect(mocks.printAgentResponseMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(kernel.dispose).toHaveBeenCalledTimes(1);
  });

  it("prints one-shot replies and leaves exitCode untouched", async () => {
    const kernel = {
      extensions: { load: vi.fn() },
      start: vi.fn(),
      dispose: vi.fn(),
      eventBus: {},
      ingress: {}
    };
    mocks.dispatchPromptOverNcpMock.mockResolvedValue("hi");

    await runCliAgentCommand({
      logo: "NextClaw",
      opts: { message: "hello" },
      config: {},
      kernel
    } as never);

    expect(mocks.printAgentResponseMock).toHaveBeenCalledWith("hi");
    expect(process.exitCode).toBeUndefined();
    expect(kernel.dispose).toHaveBeenCalledTimes(1);
  });

  it("submits the next interactive prompt before the active run finishes", async () => {
    let resolveFirstRun: ((value: string) => void) | undefined;
    let resolveExitPrompt: ((value: string) => void) | undefined;
    const firstRun = new Promise<string>((resolve) => {
      resolveFirstRun = resolve;
    });
    const exitPrompt = new Promise<string>((resolve) => {
      resolveExitPrompt = resolve;
    });
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    const kernel = {
      extensions: { load: vi.fn() },
      start: vi.fn(),
      dispose: vi.fn(),
      eventBus: {},
      ingress: {}
    };
    mocks.getDataDirMock.mockReturnValue("/tmp/nextclaw-cli-agent-runner-test");
    mocks.promptMock
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second")
      .mockReturnValueOnce(exitPrompt);
    mocks.dispatchPromptOverNcpMock
      .mockReturnValueOnce(firstRun)
      .mockResolvedValueOnce("second reply");

    const command = runCliAgentCommand({
      logo: "NextClaw",
      opts: {},
      config: {},
      kernel
    } as never);

    await vi.waitFor(() => {
      expect(mocks.dispatchPromptOverNcpMock).toHaveBeenCalledTimes(2);
    });
    expect(mocks.dispatchPromptOverNcpMock.mock.calls.map(([params]) => params.content)).toEqual([
      "first",
      "second"
    ]);

    resolveFirstRun?.("first reply");
    resolveExitPrompt?.("exit");
    await command;

    expect(mocks.printAgentResponseMock).toHaveBeenCalledWith("first reply");
    expect(mocks.printAgentResponseMock).toHaveBeenCalledWith("second reply");
    expect(kernel.dispose).toHaveBeenCalledTimes(1);
    exitSpy.mockRestore();
  });
});
