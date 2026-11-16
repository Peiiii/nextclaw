import { describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpLLMApi, type NcpLLMApiInput } from "@nextclaw/ncp";
import { SessionRun } from "@kernel/managers/session-run.manager.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import { createNativeAgentRuntimeRegistration } from "./native-agent-runtime.service.js";

describe("shared native runtime composition", () => {
  it.each(["archived-session", "new-session-large-result", "message-count-pressure"] as const)("continues real tool dispatch for %s", async (scenario) => {
    const session: AgentRunSession = { sessionId: "session", agentRuntimeId: "native", workingDir: "/", metadata: {} };
    const sessionRun = new SessionRun({ sessionId: session.sessionId, messages: [
      ...(scenario === "message-count-pressure" ? Array.from({ length: 255 }, (_, index) => ({
        id: `earlier-${index}`, sessionId: session.sessionId, role: "user" as const, status: "final" as const,
        timestamp: new Date(index).toISOString(), parts: [{ type: "text" as const, text: `Earlier constraint ${index}.` }],
      })) : []), {
      id: "user", sessionId: session.sessionId, role: "user", status: "final",
      parts: [{ type: "text", text: "Read the diagnostics, then write the requested report." }],
      metadata: scenario === "archived-session" ? { nextclaw_archived_body: true } : {},
    }] });
    const calls: string[] = [];
    const inputs: NcpLLMApiInput[] = [];
    const models: NcpLLMApi = { generate: async function* (input) {
      inputs.push(input);
      const index = inputs.length;
      if (scenario !== "archived-session" && index >= 2) {
        const observed = input.messages.filter(message => message.role === "tool").map(message => message.content).join("\n");
        expect(observed).toContain("DIAGNOSTIC_END_b63f10b8");
        if (index >= 3) expect(observed).toContain("ISSUE_END_d385f1");
      }
      if (index <= 3) {
        yield { id: `reply-${index}`, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{
          index: 0, id: `call-${index}`, type: "function", function: { name: index === 1 ? "read_file" : index === 2 ? "fetch_issue" : "write_file", arguments: "{}" },
        }] }, finish_reason: null }] };
        yield { id: `reply-${index}`, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
      } else {
        yield { id: "done", choices: [{ index: 0, delta: { content: "REPORT_SAVED" }, finish_reason: "stop" }] };
      }
    } };
    const registration = createNativeAgentRuntimeRegistration({
      models, agents: { getDefaultAgentId: () => "main", resolveAgentProfile: () => ({ contextTokens: 200_000, reservedContextTokens: 10_000 }) },
      config: { getDefaultModel: () => "test" }, sessions: { getAgentRunSession: async () => session },
      compaction: { runPreflight: async function* () {}, runManual: async () => [] },
    });
    const runtime = registration.createRuntime({ entry: { id: "native", type: "native", label: "Native" }, session, sessionRun });
    const errors: unknown[] = [];
    for await (const event of runtime.run({ agentId: "main", runId: "run", runtimeId: "native", model: "test", requestedModel: null }, {
      session, sessionRun, contextBlocks: [], initialMessages: sessionRun.getSnapshot().messages,
      tools: ["read_file", "fetch_issue", "write_file"].map(name => ({ name, description: name, parameters: { type: "object", properties: {} },
        execute: async () => { calls.push(name); return name !== "write_file" && scenario !== "archived-session"
          ? [...Array.from({ length: 39 }, (_, index) => `${index}: ${"diagnostic ".repeat(100)}`), name === "read_file" ? "DIAGNOSTIC_END_b63f10b8" : "ISSUE_END_d385f1"] : "ok"; } })),
    })) {
      if (event.type === NcpEventType.RunError) errors.push(event.payload);
      await sessionRun.applyEvents([event]);
    }
    expect(errors).toEqual([]);
    expect(calls).toEqual(["read_file", "fetch_issue", "write_file"]);
    expect(inputs).toHaveLength(4);
    expect(JSON.stringify(sessionRun.getSnapshot().messages)).toContain("REPORT_SAVED");
    sessionRun.dispose();
  });

  it.each([true, false])("preserves context injection=%s and fresh compaction metadata", async (injectNextclawContext) => {
    const inputs: NcpLLMApiInput[] = [];
    const models: NcpLLMApi = { generate: async function* (input) {
      inputs.push(input);
      yield { id: "reply", choices: [{ index: 0, delta: { role: "assistant", content: "answer" }, finish_reason: null }] };
      yield { id: "reply", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
    } };
    const session: AgentRunSession = {
      sessionId: "session", agentRuntimeId: "native", workingDir: "/",
      metadata: { checkpoint: "latest" },
    };
    const sessionRun = new SessionRun({ sessionId: "session", messages: [{
      id: "user", sessionId: "session", role: "user", status: "final",
      parts: [{ type: "text", text: "hello" }],
    }] });
    const runPreflight = vi.fn(async function* () {});
    const runManual = vi.fn(async () => []);
    const registration = createNativeAgentRuntimeRegistration({
      models, agents: {
        getDefaultAgentId: () => "main",
        resolveAgentProfile: () => ({ contextTokens: 200_000, reservedContextTokens: 10_000 }),
      },
      config: { getDefaultModel: () => "default-model" },
      sessions: { getAgentRunSession: async () => session },
      compaction: { runPreflight, runManual },
    });
    const runtime = registration.createRuntime({
      entry: { id: "native", type: "native", label: "Native", injectNextclawContext },
      session, sessionRun,
    });
    expect(runtime.capabilities?.nextStepInput).toBe(true);
    for await (const event of runtime.run({
      agentId: "main", runId: "run", runtimeId: "native", model: "test", requestedModel: null,
    }, { session, sessionRun, contextBlocks: ["UNIQUE_CONTEXT"], tools: [],
      initialMessages: sessionRun.getSnapshot().messages })) {
      await sessionRun.applyEvents([event]);
    }
    expect(inputs.length).toBeGreaterThan(0);
    expect(JSON.stringify(inputs[0].messages).includes("UNIQUE_CONTEXT")).toBe(injectNextclawContext);
    expect(runPreflight).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { checkpoint: "latest" }, sessionId: "session", model: "test",
    }));
    await runtime.compactContext?.({ session, sessionRun });
    expect(runManual).toHaveBeenCalledWith(expect.objectContaining({
      agentId: "main", model: "default-model", metadata: { checkpoint: "latest" },
    }));
  });
});
