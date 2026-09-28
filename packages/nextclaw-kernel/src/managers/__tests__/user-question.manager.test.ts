import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpMessage, type NcpRunHandle } from "@nextclaw/ncp";
import { EventBus, Ingress, ingressKeys, type AgentRunSendIngressPayload } from "@nextclaw/shared";
import { ncpMessageToOpenAiMessages } from "@nextclaw/ncp-agent-runtime";
import { ProjectManager } from "@kernel/features/projects/index.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { UserQuestionManager, type UserQuestionError } from "@kernel/managers/user-question.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

async function createFixture() {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-user-questions-"));
  tempDirs.push(home);
  const sessions = new SessionManager({
    agentContextWindowManager: { forgetSession: () => undefined, previewSession: async () => null } as never,
    agentManager: { resolveAgentProfile: () => ({ workspace: join(home, "workspace") }) } as never,
    configManager: { loadConfig: () => ({}) } as never,
    eventBus: new EventBus(),
    journalStore: new NcpAgentSessionJournalStore(join(home, "journal")),
    projectManager: new ProjectManager({
      databasePath: join(home, "projects.db"),
      legacyStorePath: join(home, "projects.json"),
      getDefaultWorkspacePath: () => join(home, "workspace"),
    }),
    sessionSearch: { handleSessionUpdated: () => undefined } as never,
  });
  await sessions.start();
  await sessions.createSession({ sessionId: "native-session", sourceSessionMetadata: {}, task: "Long task" });
  const runs = new SessionRunManager(sessions);
  const ingress = new Ingress();
  const accepted = vi.fn(async (message: NcpMessage): Promise<NcpRunHandle> => {
    await sessions.publishSessionEvent({
      sessionId: "native-session",
      event: { type: NcpEventType.MessageSent, payload: { sessionId: "native-session", message } },
      source: "test-input",
      persistFirst: true,
      synchronizeMessageProjection: true,
    });
    return { sessionId: "native-session", userMessageId: message.id, assistantMessageId: null, runId: "run-1", delivery: "steered" };
  });
  ingress.addHandler(ingressKeys.agentRun.send, async (envelope) => {
    const payload = envelope.payload as AgentRunSendIngressPayload;
    if (!("message" in payload) || !payload.message) throw new Error("expected a message");
    return await accepted(payload.message);
  });
  return { sessions, runs, accepted, questions: new UserQuestionManager(sessions, runs, ingress) };
}

describe("UserQuestionManager", () => {
  it("persists multiple independent questions and accepts one answer only once", async () => {
    const { sessions, runs, accepted, questions } = await createFixture();
    const asked = await questions.ask("native-session", [
      { title: "Which format?", options: ["PDF", "DOCX"], recommendedOption: "PDF", optionDescriptions: { PDF: "Keeps the layout fixed." } },
      { title: "Which language?" },
    ]);
    expect(asked.accepted).toBe(true);
    expect(asked.questionIds).toHaveLength(2);
    expect(await sessions.listSessionMessages("native-session")).toHaveLength(1);

    for (let index = 0; index < 45; index += 1) {
      const message: NcpMessage = {
        id: `filler-${index}`,
        sessionId: "native-session",
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: [{ type: "text", text: `Other message ${index}` }],
      };
      await sessions.publishSessionEvent({
        sessionId: "native-session",
        event: { type: NcpEventType.MessageSent, payload: { sessionId: "native-session", message } },
        source: "test-history",
        persistFirst: true,
        synchronizeMessageProjection: true,
      });
    }

    const afterRefresh = new UserQuestionManager(sessions, runs, new Ingress());
    expect((await afterRefresh.list("native-session")).map(({ status }) => status)).toEqual(["pending", "pending"]);
    expect((await afterRefresh.list("native-session"))[0]?.recommendedOption).toBe("PDF");
    expect((await afterRefresh.list("native-session"))[0]?.optionDescriptions).toEqual({ PDF: "Keeps the layout fixed." });

    const first = await questions.resolve({ sessionId: "native-session", questionId: asked.questionIds[0]!, action: "answer", answer: "PDF" });
    expect(first.handle?.delivery).toBe("steered");
    expect((await questions.list("native-session")).map(({ status }) => status)).toEqual(["answered", "pending"]);
    const duplicate = await questions.resolve({ sessionId: "native-session", questionId: asked.questionIds[0]!, action: "answer", answer: "PDF" });
    expect(duplicate.handle).toBeNull();
    expect(accepted).toHaveBeenCalledTimes(1);
    const answerMessage = accepted.mock.calls[0]![0];
    expect(answerMessage.metadata).toMatchObject({
      nextclaw_user_question_id: asked.questionIds[0],
      nextclaw_user_question_message_id: (await sessions.listSessionMessages("native-session"))[0]!.id,
      nextclaw_user_question_title: "Which format?",
      nextclaw_user_question_answer: "PDF",
    });
    expect(ncpMessageToOpenAiMessages(answerMessage)).toMatchObject([{ role: "user", content: expect.stringContaining("Question: Which format?\nAnswer: PDF") }]);
    await expect(questions.resolve({ sessionId: "native-session", questionId: asked.questionIds[0]!, action: "answer", answer: "DOCX" }))
      .rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<UserQuestionError>);

    await questions.resolve({ sessionId: "native-session", questionId: asked.questionIds[1]!, action: "dismiss" });
    expect((await questions.list("native-session")).map(({ status }) => status)).toEqual(["answered", "dismissed"]);
    expect(accepted).toHaveBeenCalledTimes(2);
  });

  it("rejects conflicting concurrent resolutions before a second input is admitted", async () => {
    const { questions, accepted } = await createFixture();
    const asked = await questions.ask("native-session", [{ title: "Priority?" }]);
    const questionId = asked.questionIds[0]!;
    const first = questions.resolve({ sessionId: "native-session", questionId, action: "answer", answer: "high" });
    await expect(questions.resolve({ sessionId: "native-session", questionId, action: "answer", answer: "low" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await first;
    expect(accepted).toHaveBeenCalledTimes(1);
  });

  it("rejects a recommendation that is not one of the suggested options", async () => {
    const { questions } = await createFixture();
    await expect(questions.ask("native-session", [{ title: "Which format?", options: ["PDF", "DOCX"], recommendedOption: "TXT" }]))
      .rejects.toMatchObject({ code: "INVALID_ANSWER" });
  });

  it("rejects an explanation for an unknown option", async () => {
    const { questions } = await createFixture();
    await expect(questions.ask("native-session", [{ title: "Which format?", options: ["PDF"], optionDescriptions: { DOCX: "Editable." } }]))
      .rejects.toMatchObject({ code: "INVALID_ANSWER" });
  });
});
