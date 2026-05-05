import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPluginRuntime, setPluginRuntimeBridge } from "./runtime.js";

const tempDirs: string[] = [];

function createTempWorkspace(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createPluginRuntime agent helpers", () => {
  it("exposes agent runtime helpers for plugin-side provider and prompt resolution", () => {
    const runtime = createPluginRuntime({
      workspace: "/tmp/nextclaw-plugin-runtime",
      config: {
        agents: {
          defaults: {
            workspace: "/tmp/nextclaw-plugin-runtime-default",
            model: "custom-1/gpt-5.4",
            maxToolIterations: 12,
          },
          context: {
            bootstrap: {
              files: [],
              minimalFiles: [],
              perFileChars: 1000,
              totalChars: 1000,
            },
          },
        },
        providers: {
          "custom-1": {
            displayName: "yunyi",
            apiKey: "test-key",
            apiBase: "https://yunyi.example.com/v1",
            models: ["gpt-5.4"],
          },
        },
      } as never,
    });

    expect(runtime.agent.defaults).toEqual({
      model: "custom-1/gpt-5.4",
      workspace: "/tmp/nextclaw-plugin-runtime",
      maxToolIterations: 12,
    });
    expect(runtime.agent.resolveWorkspacePath()).toBe("/tmp/nextclaw-plugin-runtime");
    expect(
      runtime.agent.resolveSessionWorkspacePath({
        sessionMetadata: {
          project_root: "~/workspace/project-alpha",
        },
      }),
    ).toBe(resolve(homedir(), "workspace/project-alpha"));
    expect(runtime.agent.resolveProviderRuntime("custom-1/gpt-5.4")).toEqual(
      expect.objectContaining({
        providerName: "custom-1",
        providerDisplayName: "yunyi",
        apiBase: "https://yunyi.example.com/v1",
      }),
    );
    const prompt = runtime.agent.buildRuntimeUserPrompt({
      userMessage: "Reply exactly OK",
      metadata: {
        requested_skills: ["missing-skill"],
        project_root: "/tmp/project-alpha",
      },
    });

    expect(prompt).toContain("Reply exactly OK");
    expect(prompt).toContain("Current project directory: /tmp/project-alpha");
    expect(prompt).toContain("NextClaw host workspace directory: /tmp/nextclaw-plugin-runtime");
  });
});

describe("createPluginRuntime channel helpers", () => {
  it("exposes debounce helpers required by channel gateways", async () => {
    const runtime = createPluginRuntime({
      workspace: "/tmp/nextclaw-test",
      config: {
        messages: {
          inbound: {
            debounceMs: 5,
            byChannel: {
              feishu: 20,
            },
          },
        },
      } as never,
    });

    expect(
      runtime.channel.debounce.resolveInboundDebounceMs({
        cfg: runtime.config.loadConfig(),
        channel: "feishu",
      }),
    ).toBe(20);

    const flushed: string[][] = [];
    const debouncer = runtime.channel.debounce.createInboundDebouncer<string>({
      debounceMs: 0,
      buildKey: (value: string) => value,
      onFlush: async (items: string[]) => {
        flushed.push(items);
      },
    });

    await debouncer.enqueue("hello");
    expect(flushed).toEqual([["hello"]]);
  });

  it("bridges dispatchReplyFromConfig through the runtime bridge", async () => {
    const bridgeDispatch = vi.fn(async (params: {
      dispatcherOptions: {
        deliver: (payload: { text?: string }, info: { kind: string }) => void | Promise<void>;
      };
    }) => {
      await params.dispatcherOptions.deliver({ text: "pong" }, { kind: "final" });
    });
    setPluginRuntimeBridge({
      dispatchReplyWithBufferedBlockDispatcher: bridgeDispatch,
    });

    const runtime = createPluginRuntime({
      workspace: "/tmp/nextclaw-test",
    });
    const sendFinalReply = vi.fn(() => true);
    const dispatcher = {
      sendToolResult: vi.fn(() => true),
      sendBlockReply: vi.fn(() => true),
      sendFinalReply,
      waitForIdle: async () => {},
      getQueuedCounts: () => ({
        tool: 0,
        block: 0,
        final: sendFinalReply.mock.calls.length,
      }),
      markComplete: () => {},
    };

    const result = await runtime.channel.reply.dispatchReplyFromConfig({
      ctx: {
        Body: "ping",
      },
      dispatcher,
    });

    expect(bridgeDispatch).toHaveBeenCalledTimes(1);
    expect(sendFinalReply).toHaveBeenCalledWith({ text: "pong" });
    expect(result).toEqual({
      queuedFinal: true,
      counts: {
        tool: 0,
        block: 0,
        final: 1,
      },
    });

    setPluginRuntimeBridge(null);
  });
});

describe("createPluginRuntime workspace context", () => {
  it("loads both project and host workspace context without losing host workspace skills", () => {
    const hostWorkspace = createTempWorkspace("nextclaw-plugin-runtime-host-");
    const projectWorkspace = createTempWorkspace("nextclaw-plugin-runtime-project-");
    writeFileSync(join(hostWorkspace, "AGENTS.md"), "Host workspace guidance.\n");
    writeFileSync(join(projectWorkspace, "AGENTS.md"), "Project workspace guidance.\n");
    mkdirSync(join(hostWorkspace, "skills", "host-helper"), { recursive: true });
    writeFileSync(
      join(hostWorkspace, "skills", "host-helper", "SKILL.md"),
      [
        "---",
        "name: host-helper",
        "description: Host workspace helper",
        "---",
        "",
        "Host helper instructions.",
      ].join("\n"),
    );

    const runtime = createPluginRuntime({
      workspace: hostWorkspace,
      config: {
        agents: {
          defaults: {
            workspace: hostWorkspace,
            model: "custom-1/gpt-5.4",
            maxToolIterations: 12,
          },
          context: {
            bootstrap: {
              files: ["AGENTS.md"],
              minimalFiles: ["AGENTS.md"],
              perFileChars: 1000,
              totalChars: 3000,
            },
          },
        },
        providers: {
          "custom-1": {
            displayName: "yunyi",
            apiKey: "test-key",
            apiBase: "https://yunyi.example.com/v1",
            models: ["gpt-5.4"],
          },
        },
      } as never,
    });

    const prompt = runtime.agent.buildRuntimeUserPrompt({
      userMessage: "Use the selected skill.",
      metadata: {
        project_root: projectWorkspace,
        requested_skills: ["host-helper"],
      },
    });

    expect(prompt).toContain(`Current project directory: ${projectWorkspace}`);
    expect(prompt).toContain(`NextClaw host workspace directory: ${hostWorkspace}`);
    expect(prompt).toContain("Project workspace guidance.");
    expect(prompt).toContain("Host workspace guidance.");
    expect(prompt).toContain("<name>host-helper</name>");
    expect(prompt).not.toContain("Host helper instructions.");
  });
});
