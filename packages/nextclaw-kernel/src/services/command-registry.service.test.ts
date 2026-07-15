import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { EventBus } from "@nextclaw/shared";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ProjectManager } from "@kernel/managers/project.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { CommandRegistry } from "./command-registry.service.js";

const tempDirs: string[] = [];

function createConfig() {
  return {
    agents: {
      defaults: {
        contextTokens: 200000,
        engine: "native",
        engineConfig: {},
        maxToolIterations: 1000,
        model: "default-model",
        models: {},
        thinkingDefault: "off",
        workspace: "",
      },
      list: [],
    },
  } as never;
}

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-command-registry-"));
  tempDirs.push(dir);
  const sessionManager = new SessionManager({
    agentManager: {
      resolveAgentProfile: () => ({ workspace: dir }),
      resolveAgentProfileForRun: () => ({
        contextTokens: 200000,
        model: "default-model",
        reservedContextTokens: 0,
      }),
    } as never,
    configManager: { loadConfig: createConfig } as never,
    eventBus: new EventBus(),
    journalStore: new NcpAgentSessionJournalStore(join(dir, "journal")),
    projectManager: new ProjectManager({
      storePath: join(dir, "projects.json"),
      getDefaultWorkspacePath: () => dir,
    }),
    sessionSearch: { handleSessionUpdated: async () => undefined } as never,
  });
  const registry = new CommandRegistry(createConfig(), sessionManager);
  return { registry, sessionManager };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("CommandRegistry", () => {
  it("stores model and thinking preferences in the kernel session manager", async () => {
    const { registry, sessionManager } = createFixture();
    const ctx = {
      channel: "weixin",
      chatId: "chat-1",
      senderId: "user-1",
      sessionKey: "session-1",
    };

    expect((await registry.executeText("/model openai/gpt-5", ctx))?.content)
      .toContain("Model set to openai/gpt-5");
    expect((await registry.executeText("/thinking medium", ctx))?.content)
      .toContain("Thinking effort set to medium");

    const record = await sessionManager.getSessionRecord("session-1");
    expect(record?.metadata).toMatchObject({
      model: "openai/gpt-5",
      preferred_model: "openai/gpt-5",
      preferred_thinking: "medium",
      thinking: "medium",
    });
  });

  it("clears NCP journal messages through reset", async () => {
    const { registry, sessionManager } = createFixture();
    await sessionManager.createSession({
      sessionId: "session-1",
      sourceSessionMetadata: {},
      task: "Session",
    });
    await sessionManager.appendSessionEvent({
      sessionId: "session-1",
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: "session-1",
          message: {
            id: "message-1",
            parts: [{ type: "text", text: "hello" }],
            role: "user",
            sessionId: "session-1",
            status: "final",
            timestamp: "2026-05-28T00:00:00.000Z",
          },
        },
      },
    });

    const result = await registry.executeText("/reset", {
      channel: "weixin",
      chatId: "chat-1",
      senderId: "user-1",
      sessionKey: "session-1",
    });

    expect(result?.content).toContain("Conversation history cleared (1 messages)");
    expect(await sessionManager.listSessionMessages("session-1")).toEqual([]);
  });
});
