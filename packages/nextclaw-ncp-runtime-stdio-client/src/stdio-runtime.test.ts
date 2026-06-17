import { delimiter, dirname, join } from "node:path";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import {
  buildStdioRuntimeLaunchEnv,
  probeStdioRuntime,
  StdioRuntimeConfigResolver,
  StdioRuntimeNcpAgentRuntime,
} from "./index.js";
import { formatRuntimeErrorMessage } from "./stdio-runtime-error.utils.js";

const FIXTURE_PATH = join(
  import.meta.dirname,
  "test-fixtures",
  "echo-agent.utils.mjs",
);

const DISPOSE_FIXTURE_PATH = join(
  import.meta.dirname,
  "test-fixtures",
  "dispose-agent.utils.mjs",
);

const SLOW_CANCEL_FIXTURE_PATH = join(
  import.meta.dirname,
  "test-fixtures",
  "slow-cancel-agent.mjs",
);

const HERMES_TOOL_TITLE_FIXTURE_PATH = join(
  import.meta.dirname,
  "test-fixtures",
  "hermes-tool-title-agent.utils.mjs",
);

const FAILING_FIXTURE_PATH = join(
  import.meta.dirname,
  "test-fixtures",
  "failing-agent.mjs",
);
const TEST_EXECUTION_CONTEXT = {
  cwd: dirname(FIXTURE_PATH),
};

async function waitUntilProcessStops(pid: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error(`process ${pid} did not stop`);
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("StdioRuntimeConfigResolver", () => {
  const originalCommandOverrides = process.env.NEXTCLAW_NARP_STDIO_COMMAND_OVERRIDES;

  afterEach(() => {
    if (originalCommandOverrides === undefined) {
      delete process.env.NEXTCLAW_NARP_STDIO_COMMAND_OVERRIDES;
      return;
    }
    process.env.NEXTCLAW_NARP_STDIO_COMMAND_OVERRIDES = originalCommandOverrides;
  });

  it("reads command and args from explicit config", () => {
    const resolver = new StdioRuntimeConfigResolver({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      startupTimeoutMs: 1234,
      probeTimeoutMs: 2222,
      requestTimeoutMs: 4567,
    });

    expect(resolver.resolve()).toEqual({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      startupTimeoutMs: 1234,
      probeTimeoutMs: 2222,
      requestTimeoutMs: 4567,
    });
  });

  it("applies command overrides without mutating persisted runtime config", () => {
    process.env.NEXTCLAW_NARP_STDIO_COMMAND_OVERRIDES = JSON.stringify({
      "/home/alice/.nextclaw/bin/nextclaw-codex-narp": {
        command: process.execPath,
        args: ["local-controller.ts"],
        cwd: "/repo",
        env: { LOCAL_RUNTIME: "1" },
      },
    });

    const resolver = new StdioRuntimeConfigResolver({
      wireDialect: "acp",
      processScope: "per-session",
      command: "/home/alice/.nextclaw/bin/nextclaw-codex-narp",
      args: ["configured"],
      cwd: "/configured",
      env: { CONFIGURED: "1" },
    });

    expect(resolver.resolve()).toMatchObject({
      command: process.execPath,
      args: ["local-controller.ts"],
      cwd: "/repo",
      env: { LOCAL_RUNTIME: "1" },
    });
  });
});

describe("buildStdioRuntimeLaunchEnv", () => {
  it("preserves base env for direct spawn while appending the current node bin directory", () => {
    const env = buildStdioRuntimeLaunchEnv({
      baseEnv: {
        KEEP: "base",
        NODE_OPTIONS: "--conditions=development --trace-warnings",
        PATH: ["/usr/bin", "/bin"].join(delimiter),
      },
      configEnv: {
        EXTRA: "config",
      },
    });

    expect(env.KEEP).toBe("base");
    expect(env.EXTRA).toBe("config");
    expect(env.NODE_OPTIONS).toBe("--trace-warnings");
    expect(env.PATH?.split(delimiter)).toEqual([
      "/usr/bin",
      "/bin",
      dirname(process.execPath),
    ]);
  });

  it("drops dev-only node conditions before launching external stdio runtimes", () => {
    const env = buildStdioRuntimeLaunchEnv({
      baseEnv: {
        NODE_OPTIONS: "--conditions=development",
        PATH: "/usr/bin",
      },
    });

    expect(env.NODE_OPTIONS).toBeUndefined();
  });
});

describe("StdioRuntimeNcpAgentRuntime event bridging", () => {
  it("bridges ACP stdio updates into NCP events and forwards prompt meta", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
      resolveTools: () => [
        {
          type: "function",
          function: {
            name: "list_dir",
            description: "List files",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
      ],
      resolveProviderRoute: () => ({
        model: "MiniMax-M2.7",
        apiKey: "minimax-key",
        apiBase: "https://api.minimax.chat/v1",
        headers: {
          "x-minimax-group-id": "test-group",
        },
      }),
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-stdio-runtime",
      messages: [
        {
          id: "user-1",
          sessionId: "session-stdio-runtime",
          role: "user",
          status: "final",
          timestamp: "2026-04-16T00:00:00.000Z",
          parts: [{ type: "text", text: "ping over stdio" }],
        },
      ],
      correlationId: "corr-1",
      executionContext: TEST_EXECUTION_CONTEXT,
      metadata: {
        preferredModel: "minimax/MiniMax-M2.7",
      },
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageAccepted,
      NcpEventType.RunStarted,
      NcpEventType.MessageReasoningStart,
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageToolCallStart,
      NcpEventType.MessageToolCallArgs,
      NcpEventType.MessageToolCallEnd,
      NcpEventType.MessageToolCallResult,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
      NcpEventType.MessageReasoningEnd,
      NcpEventType.MessageCompleted,
      NcpEventType.RunFinished,
    ]);

    const acceptedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageAccepted }> =>
        event.type === NcpEventType.MessageAccepted,
    );
    expect(acceptedEvent?.payload.messageId).toBeDefined();
    expect(acceptedEvent?.payload.messageId).not.toBe("user-1");

    const toolResultEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallResult }> =>
        event.type === NcpEventType.MessageToolCallResult,
    );
    expect(toolResultEvent?.payload.content).toEqual({
      modelId: "MiniMax-M2.7",
      routedModel: "MiniMax-M2.7",
      envRoutedModel: "MiniMax-M2.7",
      headerKeys: ["x-minimax-group-id"],
      envHeaderKeys: ["x-minimax-group-id"],
      toolNames: ["list_dir"],
    });

    const completedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageCompleted }> =>
        event.type === NcpEventType.MessageCompleted,
    );
    expect(completedEvent?.payload.message.id).toBe(acceptedEvent?.payload.messageId);
    expect(completedEvent?.payload.message.id).not.toBe("user-1");
    expect(completedEvent?.payload.message.parts).toEqual([
      { type: "reasoning", text: "reasoning via ACP" },
      {
        type: "tool-invocation",
        toolCallId: "call-1",
        toolName: "emit_meta",
        state: "result",
        args: "{\"requested\":true}",
        result: {
          modelId: "MiniMax-M2.7",
          routedModel: "MiniMax-M2.7",
          envRoutedModel: "MiniMax-M2.7",
          headerKeys: ["x-minimax-group-id"],
          envHeaderKeys: ["x-minimax-group-id"],
          toolNames: ["list_dir"],
        },
      },
      { type: "text", text: "pong via ACP" },
    ]);

    const runFinishedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.RunFinished }> =>
        event.type === NcpEventType.RunFinished,
    );
    expect(runFinishedEvent?.payload.messageId).toBe(acceptedEvent?.payload.messageId);
  });

  it("fails cleanly when the stdio command cannot be spawned", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: "/definitely/missing/hermes",
      args: ["acp"],
      startupTimeoutMs: 5_000,
      probeTimeoutMs: 1_000,
      requestTimeoutMs: 5_000,
    });

    await expect(
      (async () => {
        for await (const event of runtime.run({
          sessionId: "session-stdio-missing-command",
          messages: [
            {
              id: "user-1",
              sessionId: "session-stdio-missing-command",
              role: "user",
              status: "final",
              timestamp: "2026-04-17T00:00:00.000Z",
              parts: [{ type: "text", text: "ping" }],
            },
          ],
          executionContext: TEST_EXECUTION_CONTEXT,
        })) {
          void event;
          // no-op
        }
      })(),
    ).rejects.toThrow(/failed to start stdio runtime command/);
  });

  it("terminates the stdio child process when disposed", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nextclaw-stdio-runtime-"));
    const pidFile = join(tempDir, "agent.pid");
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [DISPOSE_FIXTURE_PATH],
      env: {
        NEXTCLAW_STDIO_PID_FILE: pidFile,
      },
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
    });

    try {
      for await (const event of runtime.run({
        sessionId: "session-stdio-runtime-dispose",
        messages: [
          {
            id: "user-dispose",
            sessionId: "session-stdio-runtime-dispose",
            role: "user",
            status: "final",
            timestamp: "2026-04-17T00:00:00.000Z",
            parts: [{ type: "text", text: "dispose child" }],
          },
        ],
        executionContext: TEST_EXECUTION_CONTEXT,
      })) {
        void event;
      }

      const childPid = Number(await readFile(pidFile, "utf8"));
      expect(isProcessRunning(childPid)).toBe(true);

      await runtime.dispose();

      await waitUntilProcessStops(childPid);
    } finally {
      await runtime.dispose();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

});

describe("StdioRuntimeNcpAgentRuntime cwd handling", () => {
  it("uses executionContext cwd for the ACP session while keeping cwd for the child process", async () => {
    const processCwd = await mkdtemp(join(tmpdir(), "nextclaw-stdio-process-cwd-"));
    const sessionCwd = await mkdtemp(join(tmpdir(), "nextclaw-stdio-session-cwd-"));
    const resolvedProcessCwd = await realpath(processCwd);
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      cwd: processCwd,
      env: {
        NEXTCLAW_ECHO_CWD_INFO: "1",
      },
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
    });

    try {
      const events: NcpEndpointEvent[] = [];
      for await (const event of runtime.run({
        sessionId: "session-stdio-runtime-cwd",
        messages: [
          {
            id: "user-cwd",
            sessionId: "session-stdio-runtime-cwd",
            role: "user",
            status: "final",
            timestamp: "2026-06-16T00:00:00.000Z",
            parts: [{ type: "text", text: "cwd" }],
          },
        ],
        executionContext: {
          cwd: sessionCwd,
        },
      })) {
        events.push(event);
      }

      const toolResultEvent = events.find(
        (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallResult }> =>
          event.type === NcpEventType.MessageToolCallResult,
      );
      expect(toolResultEvent?.payload.content).toMatchObject({
        processCwd: resolvedProcessCwd,
        sessionCwd,
      });
    } finally {
      await runtime.dispose();
      await rm(processCwd, { recursive: true, force: true });
      await rm(sessionCwd, { recursive: true, force: true });
    }
  });
});

describe("StdioRuntimeNcpAgentRuntime session metadata bridging", () => {
  it("bridges ACP session metadata patches into NCP run metadata", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      env: {
        NEXTCLAW_ECHO_SESSION_METADATA_PATCH_JSON: JSON.stringify({
          session_type: "codex",
          codex_thread_id: "thread-stdio-1",
        }),
      },
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-stdio-runtime-metadata",
      messages: [
        {
          id: "user-metadata",
          sessionId: "session-stdio-runtime-metadata",
          role: "user",
          status: "final",
          timestamp: "2026-04-17T00:00:00.000Z",
          parts: [{ type: "text", text: "metadata patch" }],
        },
      ],
      correlationId: "corr-metadata",
      executionContext: TEST_EXECUTION_CONTEXT,
    })) {
      events.push(event);
    }

    const metadataEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.RunMetadata }> =>
        event.type === NcpEventType.RunMetadata,
    );
    expect(metadataEvent?.payload).toMatchObject({
      sessionId: "session-stdio-runtime-metadata",
      correlationId: "corr-metadata",
      metadata: {
        kind: "session_metadata_patch",
        sessionMetadataPatch: {
          session_type: "codex",
          codex_thread_id: "thread-stdio-1",
        },
      },
    });
  });

  it("emits configured session metadata resets when a prompt times out", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [SLOW_CANCEL_FIXTURE_PATH],
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 50,
      resetSessionMetadataOnPromptTimeout: ["codex_thread_id"],
    });

    const events: NcpEndpointEvent[] = [];
    try {
      for await (const event of runtime.run({
        sessionId: "session-stdio-runtime-timeout-reset",
        messages: [
          {
            id: "user-timeout-reset",
            sessionId: "session-stdio-runtime-timeout-reset",
            role: "user",
            status: "final",
            timestamp: "2026-06-11T00:00:00.000Z",
            parts: [{ type: "text", text: "timeout reset" }],
          },
        ],
        correlationId: "corr-timeout-reset",
        executionContext: TEST_EXECUTION_CONTEXT,
        metadata: {
          codex_thread_id: "thread-stuck-1",
        },
      })) {
        events.push(event);
      }
    } finally {
      await runtime.dispose();
    }

    const metadataEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.RunMetadata }> =>
        event.type === NcpEventType.RunMetadata,
    );
    expect(metadataEvent?.payload).toMatchObject({
      sessionId: "session-stdio-runtime-timeout-reset",
      correlationId: "corr-timeout-reset",
      metadata: {
        kind: "session_metadata_patch",
        sessionMetadataPatch: {
          codex_thread_id: null,
        },
      },
    });
    expect(events.map((event) => event.type)).toContain(NcpEventType.RunError);
  });
});

describe("StdioRuntimeNcpAgentRuntime Hermes request-scoped route handling", () => {
  it("skips unstable session model switching for Hermes request-scoped ACP runs", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      env: {
        NEXTCLAW_HERMES_ACP_ROUTE_BRIDGE: "1",
      },
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
      resolveProviderRoute: () => ({
        model: "qwen3.6-plus",
        apiKey: "dashscope-key",
        apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        headers: {
          "x-dashscope-workspace": "workspace-456",
        },
      }),
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-stdio-hermes-route-truth",
      messages: [
        {
          id: "user-hermes-route-truth",
          sessionId: "session-stdio-hermes-route-truth",
          role: "user",
          status: "final",
          timestamp: "2026-04-17T00:00:00.000Z",
          parts: [{ type: "text", text: "route truth" }],
        },
      ],
      metadata: {
        preferredModel: "dashscope/qwen3.6-plus",
      },
      executionContext: TEST_EXECUTION_CONTEXT,
    })) {
      events.push(event);
    }

    const toolResultEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallResult }> =>
        event.type === NcpEventType.MessageToolCallResult,
    );
    expect(toolResultEvent?.payload.content).toEqual({
      modelId: null,
      routedModel: "qwen3.6-plus",
      envRoutedModel: "qwen3.6-plus",
      headerKeys: ["x-dashscope-workspace"],
      envHeaderKeys: ["x-dashscope-workspace"],
      toolNames: [],
    });
  });

  it("does not forward the runtime-default sentinel as an ACP session model", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FIXTURE_PATH],
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-stdio-runtime-default-model",
      messages: [
        {
          id: "user-runtime-default-model",
          sessionId: "session-stdio-runtime-default-model",
          role: "user",
          status: "final",
          timestamp: "2026-04-17T00:00:00.000Z",
          parts: [{ type: "text", text: "runtime default" }],
        },
      ],
      metadata: {
        preferred_model: "__nextclaw_runtime_default__",
        model: "__nextclaw_runtime_default__",
      },
      executionContext: TEST_EXECUTION_CONTEXT,
    })) {
      events.push(event);
    }

    const toolResultEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallResult }> =>
        event.type === NcpEventType.MessageToolCallResult,
    );
    expect(toolResultEvent?.payload.content).toMatchObject({
      modelId: null,
      routedModel: null,
      envRoutedModel: null,
    });
  });

});

describe("StdioRuntimeNcpAgentRuntime failure handling", () => {
  it("preserves stderr diagnostics in runtime errors", () => {
    expect(
      formatRuntimeErrorMessage(new Error("Internal error"), {
        stderr: "fixture stderr diagnostic",
      }),
    ).toBe("Internal error. stderr=fixture stderr diagnostic");
  });

  it("emits explicit failure events when the ACP prompt fails", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [FAILING_FIXTURE_PATH],
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-stdio-failing-prompt",
      messages: [
        {
          id: "user-failing-prompt",
          sessionId: "session-stdio-failing-prompt",
          role: "user",
          status: "final",
          timestamp: "2026-04-17T00:00:00.000Z",
          parts: [{ type: "text", text: "fail please" }],
        },
      ],
      executionContext: TEST_EXECUTION_CONTEXT,
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageAccepted,
      NcpEventType.RunStarted,
      NcpEventType.MessageFailed,
      NcpEventType.RunError,
    ]);

    const failedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageFailed }> =>
        event.type === NcpEventType.MessageFailed,
    );
    const runErrorEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.RunError }> =>
        event.type === NcpEventType.RunError,
    );
    expect(failedEvent?.payload.error.code).toBe("runtime-error");
    expect(failedEvent?.payload.error.message).toContain("fixture prompt failure");
    expect(runErrorEvent?.payload.error).toContain("fixture prompt failure");
  });

});

describe("StdioRuntimeNcpAgentRuntime tool normalization", () => {
  it("normalizes Hermes ACP tool titles back to canonical tool names", async () => {
    const runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: process.execPath,
      args: [HERMES_TOOL_TITLE_FIXTURE_PATH],
      startupTimeoutMs: 10_000,
      probeTimeoutMs: 3_000,
      requestTimeoutMs: 30_000,
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-stdio-hermes-tool-title",
      messages: [
        {
          id: "user-hermes-title",
          sessionId: "session-stdio-hermes-tool-title",
          role: "user",
          status: "final",
          timestamp: "2026-04-17T00:00:00.000Z",
          parts: [{ type: "text", text: "normalize Hermes title" }],
        },
      ],
      executionContext: TEST_EXECUTION_CONTEXT,
    })) {
      events.push(event);
    }

    const toolCallStartEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallStart }> =>
        event.type === NcpEventType.MessageToolCallStart,
    );
    expect(toolCallStartEvent?.payload.toolName).toBe("terminal");

    const completedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageCompleted }> =>
        event.type === NcpEventType.MessageCompleted,
    );
    expect(completedEvent?.payload.message.parts).toEqual([
      {
        type: "tool-invocation",
        toolCallId: "hermes-title-call-1",
        toolName: "terminal",
        state: "result",
        args: "{\"command\":\"pwd\"}",
        result: {
          ok: true,
        },
      },
      { type: "text", text: "done" },
    ]);
  });
});

describe("probeStdioRuntime", () => {
  it("fails cleanly when the probe command cannot be spawned", async () => {
    await expect(
      probeStdioRuntime({
        wireDialect: "acp",
        processScope: "per-session",
        command: "/definitely/missing/hermes",
        args: ["acp"],
        startupTimeoutMs: 5_000,
        probeTimeoutMs: 1_000,
        requestTimeoutMs: 5_000,
      }),
    ).rejects.toThrow(/failed to start stdio runtime command/);
  });
});
