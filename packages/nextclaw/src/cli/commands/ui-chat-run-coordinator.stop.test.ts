import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager, type SessionEvent } from "@nextclaw/core";
import type { AgentEngineDirectRequest } from "@nextclaw/core";
import { UiChatRunCoordinator } from "./ui-chat-run-coordinator.js";

const tempDirs: string[] = [];
const originalHome = process.env.NEXTCLAW_HOME;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

afterEach(() => {
  if (typeof originalHome === "string") {
    process.env.NEXTCLAW_HOME = originalHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function createSessionEvent(role: string, extra: Record<string, unknown> = {}): SessionEvent {
  const timestamp = new Date().toISOString();
  return {
    seq: 1,
    type: role === "tool" ? "tool.result" : "message.assistant",
    timestamp,
    data: {
      message: {
        role,
        content: role,
        timestamp,
        ...extra
      }
    }
  };
}

describe("UiChatRunCoordinator stop behavior", () => {
  it("marks run aborted immediately without waiting runtime completion", async () => {
    const home = createTempDir("nextclaw-home-stop-immediate-");
    process.env.NEXTCLAW_HOME = home;
    const workspace = createTempDir("nextclaw-workspace-stop-immediate-");
    const sessionManager = new SessionManager(workspace);

    const runtimeProcessDirect = vi.fn(async (_params: AgentEngineDirectRequest) => {
      await sleep(200);
      return "late-reply";
    });

    const coordinator = new UiChatRunCoordinator({
      runtimePool: {
        listAvailableEngineKinds: () => ["native"],
        supportsTurnAbort: () => ({ supported: true, agentId: "main" }),
        processDirect: runtimeProcessDirect
      } as never,
      sessionManager
    });

    const run = coordinator.startRun({
      runId: "run-stop-immediate",
      message: "hello",
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui"
    });

    const stopStartedAt = Date.now();
    const stopResult = await coordinator.stopRun({ runId: run.runId });
    const stopDurationMs = Date.now() - stopStartedAt;
    const stoppedRun = coordinator.getRun({ runId: run.runId });

    expect(stopResult.stopped).toBe(true);
    expect(stopDurationMs).toBeLessThan(200);
    expect(stoppedRun?.state).toBe("aborted");

    await sleep(220);
  });

  it("drops post-stop tool/session events from runtime callbacks", async () => {
    const home = createTempDir("nextclaw-home-stop-toolcut-");
    process.env.NEXTCLAW_HOME = home;
    const workspace = createTempDir("nextclaw-workspace-stop-toolcut-");
    const sessionManager = new SessionManager(workspace);

    let runtimeStartedResolve: (() => void) | null = null;
    const runtimeStarted = new Promise<void>((resolve) => {
      runtimeStartedResolve = resolve;
    });
    const runtimeProcessDirect = vi.fn(async (params: AgentEngineDirectRequest) => {
      runtimeStartedResolve?.();
      await sleep(40);
      params.onSessionEvent?.(createSessionEvent("assistant", { tool_calls: [{ id: "call-1" }] }));
      params.onSessionEvent?.(createSessionEvent("tool", { tool_call_id: "call-1", name: "exec" }));
      params.onAssistantDelta?.("late-delta");
      return "late-reply";
    });

    const coordinator = new UiChatRunCoordinator({
      runtimePool: {
        listAvailableEngineKinds: () => ["native"],
        supportsTurnAbort: () => ({ supported: true, agentId: "main" }),
        processDirect: runtimeProcessDirect
      } as never,
      sessionManager
    });

    const run = coordinator.startRun({
      runId: "run-stop-toolcut",
      message: "hello",
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui"
    });
    await runtimeStarted;

    const stopResult = await coordinator.stopRun({ runId: run.runId });
    expect(stopResult.stopped).toBe(true);

    await sleep(80);
    const events: Array<{ type: string; role?: string }> = [];
    for await (const event of coordinator.streamRun({ runId: run.runId })) {
      if (event.type === "session_event") {
        events.push({ type: event.type, role: event.event.message?.role as string | undefined });
      } else {
        events.push({ type: event.type });
      }
    }

    const toolVisibleEvents = events.filter((event) => event.type === "session_event" && event.role === "tool");
    expect(toolVisibleEvents).toEqual([]);
  });
});
