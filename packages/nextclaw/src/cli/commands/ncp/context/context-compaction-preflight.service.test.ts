import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { type LLMResponse, type ProviderManager, SessionManager } from "@nextclaw/core";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";
import { createNcpTestConfig } from "./nextclaw-ncp-context-builder.test-support.js";
import { toNcpMessages } from "../session/nextclaw-agent-session-message-adapter.utils.js";

const tempWorkspaces: string[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-context-compaction-preflight-test-"));
  tempWorkspaces.push(workspace);
  const home = join(workspace, "home");
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  return workspace;
}

afterEach(() => {
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

class SummaryProviderManager {
  readonly calls: Array<{ messages: Array<Record<string, unknown>>; model?: string | null; maxTokens?: number }> = [];

  get = () => ({
    getDefaultModel: () => "default-model",
  });

  chat = async (params: {
    messages: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
  }): Promise<LLMResponse> => {
    const { maxTokens, messages, model } = params;
    this.calls.push({
      messages: structuredClone(messages),
      model,
      maxTokens,
    });
    return {
      content: "# Compressed Earlier Context\n\nLLM-generated checkpoint summary.",
      toolCalls: [],
      finishReason: "stop",
      usage: {},
    };
  };
}

it("creates an LLM-generated context compaction checkpoint during nextclaw-owned send preflight", async () => {
  const workspace = createWorkspace();
  const sessionManager = new SessionManager(workspace);
  const providerManager = new SummaryProviderManager();
  const service = new ContextCompactionPreflightService({
    getConfig: () => createNcpTestConfig(workspace, { contextTokens: 1400 }),
    providerManager: providerManager as unknown as ProviderManager,
    sessionManager,
  });
  const sessionId = `session-${randomUUID()}`;
  const session = sessionManager.getOrCreate(sessionId);
  for (let index = 0; index < 18; index += 1) {
    sessionManager.addMessage(
      session,
      index % 2 === 0 ? "user" : "assistant",
      `historical message ${index} ${"details ".repeat(100)}`,
    );
  }
  sessionManager.addMessage(session, "user", "current message after checkpoint");
  sessionManager.save(session);

  const sessionMessages = toNcpMessages(sessionId, session.messages);
  const currentInputMessage = sessionMessages.at(-1);
  const currentSessionMessage = session.messages.at(-1);
  if (currentInputMessage && currentSessionMessage) {
    currentSessionMessage.ncp_message_id = currentInputMessage.id;
  }
  const result = await service.run({
    contextWindowOwner: "nextclaw",
    inputMessages: currentInputMessage ? [currentInputMessage] : [],
    requestMetadata: {},
    sessionId,
    sessionMessages,
  });

  const updatedSession = sessionManager.getOrCreate(sessionId);
  expect(result?.timelineMessage?.role).toBe("service");
  expect(result?.timelineMessage?.metadata).toMatchObject({
    nextclaw_timeline_kind: "context_compaction",
    checkpoint: {
      status: "compressed",
    },
  });
  const serviceIndex = updatedSession.messages.findIndex((message) => message.role === "service");
  const currentIndex = updatedSession.messages.findIndex((message) => message.content === "current message after checkpoint");
  expect(serviceIndex).toBeGreaterThanOrEqual(0);
  expect(currentIndex).toBeGreaterThan(serviceIndex);
  expect(updatedSession.messages.filter((message) => message.role !== "service")).toHaveLength(19);
  expect(updatedSession.messages.some((message) => message.role === "service")).toBe(true);
  expect(updatedSession.metadata.last_context_window).toBeUndefined();
  expect(result?.contextWindow).toMatchObject({
    version: 1,
    compacted: true,
    compactedMessageCount: expect.any(Number),
  });
  const contextWindow = result?.contextWindow as Record<string, unknown>;
  const checkpointWindow = updatedSession.metadata.last_context_compaction as Record<string, unknown>;
  expect(contextWindow.usedContextTokens).toBe(contextWindow.prunedUsedContextTokens);
  expect(Number(contextWindow.usedContextTokens)).toBeLessThan(Number(checkpointWindow.originalEstimatedTokens));
  expect(Number(contextWindow.usedContextTokens)).toBeLessThanOrEqual(Number(contextWindow.totalContextTokens));
  expect(updatedSession.metadata.last_context_compaction).toMatchObject({
    version: 1,
    status: "compressed",
    summary: expect.stringContaining("Compressed Earlier Context"),
  });
  expect(providerManager.calls).toHaveLength(1);
  expect(String(providerManager.calls[0]?.messages[1]?.content)).toContain("historical message 0");
  const resultServiceIndex = result?.sessionMessages.findIndex((message) => message.role === "service") ?? -1;
  const resultCurrentIndex = result?.sessionMessages.findIndex((message) => message.id === currentInputMessage?.id) ?? -1;
  expect(resultServiceIndex).toBeGreaterThanOrEqual(0);
  expect(resultCurrentIndex).toBeGreaterThan(resultServiceIndex);
});

it("skips nextclaw compaction for runtime-owned context windows", async () => {
  const workspace = createWorkspace();
  const sessionManager = new SessionManager(workspace);
  const providerManager = new SummaryProviderManager();
  const service = new ContextCompactionPreflightService({
    getConfig: () => createNcpTestConfig(workspace, { contextTokens: 1400 }),
    providerManager: providerManager as unknown as ProviderManager,
    sessionManager,
  });
  const sessionId = `session-${randomUUID()}`;
  const session = sessionManager.getOrCreate(sessionId);
  sessionManager.addMessage(session, "user", "hello");
  sessionManager.save(session);

  await expect(service.run({
    contextWindowOwner: "runtime",
    inputMessages: [],
    requestMetadata: {},
    sessionId,
    sessionMessages: toNcpMessages(sessionId, session.messages),
  })).resolves.toBeNull();
  expect(providerManager.calls).toHaveLength(0);
  expect(sessionManager.getOrCreate(sessionId).metadata.last_context_compaction).toBeUndefined();
});

it("previews a context window snapshot without persisting metadata or calling the LLM", () => {
  const workspace = createWorkspace();
  const sessionManager = new SessionManager(workspace);
  const providerManager = new SummaryProviderManager();
  const service = new ContextCompactionPreflightService({
    getConfig: () => createNcpTestConfig(workspace, { contextTokens: 1000 }),
    providerManager: providerManager as unknown as ProviderManager,
    sessionManager,
  });
  const sessionId = `session-${randomUUID()}`;
  const session = sessionManager.getOrCreate(sessionId);
  sessionManager.addMessage(session, "user", `hello ${"details ".repeat(120)}`);
  sessionManager.save(session);

  const contextWindow = service.preview({
    contextWindowOwner: "nextclaw",
    requestMetadata: {},
    sessionId,
    sessionMessages: toNcpMessages(sessionId, session.messages),
  });

  expect(contextWindow).toMatchObject({
    version: 1,
    totalContextTokens: 1000,
  });
  expect(contextWindow?.usedContextTokens).toBeLessThanOrEqual(1000);
  expect(sessionManager.getOrCreate(sessionId).metadata.last_context_window).toBeUndefined();
  expect(sessionManager.getOrCreate(sessionId).metadata.last_context_compaction).toBeUndefined();
  expect(providerManager.calls).toHaveLength(0);
});

it("skips context window preview for runtime-owned context windows", () => {
  const workspace = createWorkspace();
  const sessionManager = new SessionManager(workspace);
  const service = new ContextCompactionPreflightService({
    getConfig: () => createNcpTestConfig(workspace, { contextTokens: 1000 }),
    sessionManager,
  });

  expect(service.preview({
    contextWindowOwner: "runtime",
    requestMetadata: {},
    sessionId: "runtime-session",
    sessionMessages: [],
  })).toBeNull();
});

it("keeps leading system messages out of the LLM compaction source", async () => {
  const workspace = createWorkspace();
  const sessionManager = new SessionManager(workspace);
  const providerManager = new SummaryProviderManager();
  const service = new ContextCompactionPreflightService({
    getConfig: () => createNcpTestConfig(workspace, { contextTokens: 1400 }),
    providerManager: providerManager as unknown as ProviderManager,
    sessionManager,
  });
  const sessionId = `session-${randomUUID()}`;
  const session = sessionManager.getOrCreate(sessionId);
  sessionManager.addMessage(session, "system", "DO_NOT_COMPRESS_SYSTEM_PROMPT");
  for (let index = 0; index < 18; index += 1) {
    sessionManager.addMessage(
      session,
      index % 2 === 0 ? "user" : "assistant",
      `historical message ${index} ${"details ".repeat(100)}`,
    );
  }
  sessionManager.addMessage(session, "user", "current message after checkpoint");
  sessionManager.save(session);

  const sessionMessages = toNcpMessages(sessionId, session.messages);
  const currentInputMessage = sessionMessages.at(-1);
  await service.run({
    contextWindowOwner: "nextclaw",
    inputMessages: currentInputMessage ? [currentInputMessage] : [],
    requestMetadata: {},
    sessionId,
    sessionMessages,
  });

  const compactionSource = String(providerManager.calls[0]?.messages[1]?.content);
  expect(providerManager.calls).toHaveLength(1);
  expect(compactionSource).not.toContain("DO_NOT_COMPRESS_SYSTEM_PROMPT");
  expect(compactionSource).toContain("historical message 0");
});
