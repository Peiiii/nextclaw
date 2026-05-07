import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "../config/schema.js";
import { SessionManager } from "../session/manager.js";
import { CommandRegistry } from "./registry.js";

const workspaces: string[] = [];

function createSessionManager(): SessionManager {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-command-registry-test-"));
  workspaces.push(workspace);
  return new SessionManager(workspace);
}

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("CommandRegistry text commands", () => {
  it("returns null for non-command text", async () => {
    const registry = new CommandRegistry(ConfigSchema.parse({}));
    const result = await registry.executeText("hello", {
      channel: "ui",
      chatId: "web-ui",
      senderId: "user-1"
    });
    expect(result).toBeNull();
  });

  it("parses slash command text and captures tail args", () => {
    const registry = new CommandRegistry(ConfigSchema.parse({}));
    const parsed = registry.parseTextCommand("/model openai/gpt-5");
    expect(parsed).toEqual({
      name: "model",
      args: { name: "openai/gpt-5" }
    });
  });

  it("executes text command and mutates session state", async () => {
    const sessionManager = createSessionManager();
    const registry = new CommandRegistry(ConfigSchema.parse({}), sessionManager);
    const sessionKey = "agent:main:ui:direct:web-ui";
    const session = sessionManager.getOrCreate(sessionKey);
    sessionManager.addMessage(session, "user", "hello");
    sessionManager.addMessage(session, "assistant", "world");
    sessionManager.save(session);

    const resetResult = await registry.executeText("/new", {
      channel: "ui",
      chatId: "web-ui",
      senderId: "user-1",
      sessionKey
    });
    expect(resetResult?.content).toContain("Conversation history cleared");
    expect(session.messages.length).toBe(0);

    const modelResult = await registry.executeText("/model openai/gpt-5", {
      channel: "ui",
      chatId: "web-ui",
      senderId: "user-1",
      sessionKey
    });
    expect(modelResult?.content).toContain("Model set to openai/gpt-5");
    expect(session.metadata.preferred_model).toBe("openai/gpt-5");

    const thinkingResult = await registry.executeText("/thinking medium", {
      channel: "ui",
      chatId: "web-ui",
      senderId: "user-1",
      sessionKey
    });
    expect(thinkingResult?.content).toContain("Thinking effort set to medium");
    expect(session.metadata.preferred_thinking).toBe("medium");

    const clearThinkingResult = await registry.executeText("/thinking clear", {
      channel: "ui",
      chatId: "web-ui",
      senderId: "user-1",
      sessionKey
    });
    expect(clearThinkingResult?.content).toContain("Thinking override cleared");
    expect(session.metadata.preferred_thinking).toBeUndefined();
  });

  it("returns friendly error for unknown slash command", async () => {
    const registry = new CommandRegistry(ConfigSchema.parse({}));
    const result = await registry.executeText("/unknown", {
      channel: "ui",
      chatId: "web-ui",
      senderId: "user-1"
    });
    expect(result?.content).toContain("Unknown command");
  });
});
