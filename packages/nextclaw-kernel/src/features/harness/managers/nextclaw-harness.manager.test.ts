import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus, Ingress, createTypedKey } from "@nextclaw/shared";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { Contribution, NextclawContributionRegistry } from "./nextclaw-contribution.manager.js";
import { NextclawSession, NextclawSessionRegistry } from "./nextclaw-session.manager.js";
import { startPromptOverNcpExecution } from "@kernel/features/ncp-dispatch/index.js";
import { runNextclawTaskWithHarness } from "@kernel/features/harness/utils/nextclaw-task.utils.js";
import type {
  IKernel,
  INextclawHarness,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

describe("Harness contribution lifecycle", () => {
  it("binds the restricted kernel and releases effects in reverse order", async () => {
    const calls: string[] = [];
    const kernel = {
      tools: {
        register: vi.fn(() => () => calls.push("dispose:tool")),
      },
    } as unknown as IKernel;

    class FixtureContribution extends Contribution {
      constructor() {
        super({ id: "fixture" });
      }

      protected setup = (): void => {
        this.effect(() => {
          calls.push("start:first");
          return () => calls.push("dispose:first");
        });
        this.effect(() => {
          calls.push("start:tool");
          return this.kernel.tools.register({ name: "fixture" } as never);
        });
      };
    }

    const registry = new NextclawContributionRegistry();
    registry.register(new FixtureContribution());
    await registry.start(kernel);
    await registry.dispose();

    expect(calls).toEqual([
      "start:first",
      "start:tool",
      "dispose:tool",
      "dispose:first",
    ]);
  });

  it("releases event and ingress registrations through the contribution scope", async () => {
    const eventBus = new EventBus();
    const ingress = new Ingress();
    const eventKey = createTypedKey<string>("fixture.event");
    const ingressKey = createTypedKey<{ value: string }>("fixture.ingress");
    const observed: string[] = [];

    class InfrastructureContribution extends Contribution {
      constructor() {
        super({ id: "infrastructure" });
      }

      protected setup = (): void => {
        this.effect(() =>
          this.kernel.eventBus.on(eventKey, (payload) => observed.push(payload)),
        );
        this.effect(() =>
          this.kernel.ingress.addHandler(ingressKey, ({ payload }) =>
            payload?.value.toUpperCase(),
          ),
        );
      };
    }

    const registry = new NextclawContributionRegistry();
    registry.register(new InfrastructureContribution());
    await registry.start({ eventBus, ingress } as unknown as IKernel);

    eventBus.emit(eventKey, "before-dispose");
    await expect(
      ingress.handle(
        { type: ingressKey, payload: { value: "ready" } },
        { source: "test" },
      ),
    ).resolves.toBe("READY");

    await registry.dispose();
    eventBus.emit(eventKey, "after-dispose");

    expect(observed).toEqual(["before-dispose"]);
    await expect(
      ingress.handle(
        { type: ingressKey, payload: { value: "released" } },
        { source: "test" },
      ),
    ).rejects.toThrow("Unsupported ingress type: fixture.ingress");
  });
});

describe("runNextclawTaskWithHarness", () => {
  it("always disposes the supplied harness", async () => {
    const harness = {
      start: vi.fn(async () => undefined),
      runTask: vi.fn(async () => ({ text: "done" })),
      dispose: vi.fn(async () => undefined),
    } as unknown as INextclawHarness;

    await expect(
      runNextclawTaskWithHarness(harness, { input: "hello" }),
    ).resolves.toMatchObject({ text: "done" });
    expect(harness.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("Harness session cleanup", () => {
  it("rejects an invalid per-call output-token cap before dispatch", async () => {
    const startExecution = vi.fn();
    const session = new NextclawSession("mori", "exec:one", startExecution);
    await expect(session.run({ input: "hello", maxTokens: 0 })).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(startExecution).not.toHaveBeenCalled();
  });

  it("deletes a completed session journal and refuses to delete an active run", async () => {
    const deleteSession = vi.fn(async () => undefined);
    let running = true;
    const sessions = new NextclawSessionRegistry(() => ({
      isSessionRunning: () => running,
      sessionManager: { deleteSession },
    }) as never);

    await expect(sessions.delete("  exec:one  ")).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(deleteSession).not.toHaveBeenCalled();

    running = false;
    await sessions.delete("  exec:one  ");
    expect(deleteSession).toHaveBeenCalledExactlyOnceWith("exec:one");
  });
});

describe("Restricted Harness dispatch", () => {
  it("routes slash-prefixed visitor text to the Agent instead of a command", async () => {
    const startRun = vi.fn(async (_payload: unknown) => ({ handle: { sessionId: "exec:one" } }));
    const result = await startPromptOverNcpExecution({
      config: {
        agents: { defaults: { id: "main" }, list: [] },
        bindings: [],
        session: { dmScope: "per-channel-peer" },
      } as never,
      agentRunClient: { startRun } as never,
      content: "/help",
      metadata: { maxTokens: 800 },
      sessionKey: "exec:one",
      allowSlashCommands: false,
    });

    expect(result.kind).toBe("agent");
    expect(startRun).toHaveBeenCalledTimes(1);
    expect(startRun.mock.calls[0]?.[0]).toMatchObject({
      metadata: { maxTokens: 800 },
    });
  });
});

describe("Harness custom configuration", () => {
  it("waits for pending session writes before Kernel disposal completes", async () => {
    const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-harness-flush-"));
    const configPath = join(homeDir, "config.json");
    writeFileSync(configPath, JSON.stringify({
      agents: { defaults: { workspace: join(homeDir, "workspace") } },
    }));
    const kernel = new NextclawKernel({ homeDir, configPath });
    let releaseFlush: (() => void) | undefined;
    const pendingFlush = new Promise<void>((resolve) => {
      releaseFlush = resolve;
    });
    const flush = vi.spyOn(kernel.sessionManager, "flushSessionEvents")
      .mockImplementation(async () => await pendingFlush);
    try {
      await kernel.start();
      let disposed = false;
      const disposal = kernel.dispose().then(() => { disposed = true; });
      await vi.waitFor(() => expect(flush).toHaveBeenCalledOnce());
      expect(disposed).toBe(false);
      releaseFlush?.();
      await disposal;
      expect(disposed).toBe(true);
    } finally {
      releaseFlush?.();
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it("creates an Agent in the supplied config file, not the default home", async () => {
    const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-harness-agent-"));
    const configPath = join(homeDir, "config.json");
    writeFileSync(configPath, JSON.stringify({
      agents: { defaults: { workspace: join(homeDir, "workspace") } },
    }));
    const kernel = new NextclawKernel({ homeDir, configPath });
    try {
      await kernel.agents.createAgent({ id: "mori", displayName: "墨里" });
      expect(kernel.agents.getAgent("mori")?.id).toBe("mori");
      expect(readFileSync(configPath, "utf8")).toContain('"mori"');
    } finally {
      await kernel.dispose();
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it("does not start a session-search index when disabled for ephemeral runs", async () => {
    const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-harness-search-"));
    const configPath = join(homeDir, "config.json");
    writeFileSync(configPath, JSON.stringify({
      agents: { defaults: { workspace: join(homeDir, "workspace") } },
    }));
    const kernel = new NextclawKernel({
      homeDir,
      configPath,
      sessionSearchEnabled: false,
    });
    const startSearch = vi.spyOn(kernel.sessionSearch, "start");
    try {
      await kernel.start();
      expect(startSearch).not.toHaveBeenCalled();
    } finally {
      await kernel.dispose();
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it("lets an embedding own compact context and avoid title-model calls", async () => {
    const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-harness-compact-"));
    const configPath = join(homeDir, "config.json");
    writeFileSync(configPath, JSON.stringify({
      agents: { defaults: { workspace: join(homeDir, "workspace") } },
    }));
    const kernel = new NextclawKernel({
      homeDir,
      configPath,
      contextProfile: "embedded",
      sessionTitleEnabled: false,
    });
    try {
      await kernel.start();
      const context = await kernel.contextProviderManager.buildContext({
        message: { id: "message-one", role: "user", parts: [{ type: "text", text: "hi" }], status: "final" },
      } as never);
      expect(context.join("\n")).toContain("## Safety");
      expect(context.join("\n")).toContain("## Tool Use Enforcement");
      expect(context.join("\n")).not.toContain("CLI Quick Reference");
      expect((kernel.sessionManager as unknown as { titles?: unknown }).titles).toBeUndefined();
      expect(kernel.assetStore.rootDir).toBe(join(homeDir, "assets"));
    } finally {
      await kernel.dispose();
      rmSync(homeDir, { recursive: true, force: true });
    }
  });
});
