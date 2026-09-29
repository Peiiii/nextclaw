import { describe, expect, it, vi } from "vitest";
import type { NcpLLMApi, NcpLLMApiInput } from "@nextclaw/ncp";
import { SessionRun } from "@kernel/managers/session-run.manager.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import { createNativeAgentRuntimeRegistration } from "./native-agent-runtime.service.js";

describe("shared native runtime composition", () => {
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
