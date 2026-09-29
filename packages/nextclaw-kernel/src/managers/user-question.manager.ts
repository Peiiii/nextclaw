import { NcpEventType, type NcpRunHandle } from "@nextclaw/ncp";
import { ingressKeys, type AgentRunSendIngressPayload, type Ingress } from "@nextclaw/shared";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type { AgentRunClient, AgentRunReplyOptions } from "@kernel/services/agent-run-client.service.js";
import { createQuestionMessage, createQuestionResolutionMessage, projectUserQuestions } from "@kernel/utils/user-question.utils.js";
import type { UserQuestionPrompt, UserQuestionView } from "@kernel/utils/user-question.utils.js";
export { USER_QUESTION_EXTENSION_TYPE } from "@kernel/utils/user-question.utils.js";
export type { UserQuestionPrompt, UserQuestionView } from "@kernel/utils/user-question.utils.js";

export type UserQuestionResolution = {
  question: UserQuestionView;
  handle: NcpRunHandle | null;
};

export type UserQuestionReplyResolution = UserQuestionResolution & { text: string | null };

export class UserQuestionError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID_ANSWER" | "CONFLICT" | "UNSUPPORTED_RUNTIME", message: string) {
    super(message);
    this.name = "UserQuestionError";
  }
}

export class UserQuestionManager {
  private readonly resolutions = new Map<string, { signature: string; promise: Promise<UserQuestionResolution> }>();

  constructor(
    private readonly sessions: SessionManager,
    private readonly runs: SessionRunManager,
    private readonly ingress: Ingress,
  ) {}

  ask = async (sessionId: string, prompts: readonly UserQuestionPrompt[]): Promise<{ accepted: true; questionIds: string[] }> => {
    await this.assertNativeSession(sessionId);
    let created: ReturnType<typeof createQuestionMessage>;
    try { created = createQuestionMessage(sessionId, prompts); }
    catch (error) { throw new UserQuestionError("INVALID_ANSWER", error instanceof Error ? error.message : "Invalid question"); }
    const { message } = created;
    const event = {
      type: NcpEventType.MessageSent as const,
      occurredAt: message.timestamp,
      payload: { sessionId, message },
    };
    await this.sessions.publishSessionEvent({
      sessionId,
      event,
      source: "user-question",
      persistFirst: true,
      synchronizeMessageProjection: true,
    });
    await this.runs.getSessionRun(sessionId)?.applyEvents([event]);
    return { accepted: true, questionIds: created.questionIds };
  };

  list = async (sessionId: string): Promise<UserQuestionView[]> => {
    const session = await this.sessions.getSession(sessionId);
    if (!session) throw new UserQuestionError("NOT_FOUND", "Session not found.");
    const runSession = await this.sessions.getAgentRunSession(sessionId);
    if (runSession.agentRuntimeId !== "native") return [];
    const durable = await this.sessions.listSessionMessages(sessionId);
    const run = this.runs.getSessionRun(sessionId);
    const messages = new Map(durable.map((message) => [message.id, message]));
    for (const message of run?.getSnapshot().messages ?? []) messages.set(message.id, message);
    for (const pending of run?.listPendingRequests() ?? []) {
      messages.set(pending.request.message.id, pending.request.message);
    }
    return projectUserQuestions([...messages.values()]);
  };

  resolve = async (input: { sessionId: string; questionId: string; action: "answer" | "dismiss"; answer?: string }): Promise<UserQuestionResolution> => {
    const key = `${input.sessionId}\0${input.questionId}`;
    const signature = `${input.action}\0${input.answer?.trim() ?? ""}`;
    const active = this.resolutions.get(key);
    if (active) {
      if (active.signature !== signature) {
        throw new UserQuestionError("CONFLICT", "This question is already being resolved differently.");
      }
      return await active.promise;
    }
    const resolution = this.resolveOnce(input);
    this.resolutions.set(key, { signature, promise: resolution });
    try {
      return await resolution;
    } finally {
      if (this.resolutions.get(key)?.promise === resolution) this.resolutions.delete(key);
    }
  };

  resolveAndWaitForReply = async (
    input: { sessionId: string; questionId: string; action: "answer" | "dismiss"; answer?: string },
    client: AgentRunClient,
    options: AgentRunReplyOptions = {},
  ): Promise<UserQuestionReplyResolution> => {
    const prepared = await this.prepareResolution(input);
    if (!prepared.payload) return { question: prepared.question, handle: null, text: null };
    const reply = await client.sendAndWaitForReply(prepared.payload, options);
    const question = (await this.list(input.sessionId)).find(({ id }) => id === input.questionId);
    return { question: question ?? prepared.question, handle: reply.handle, text: reply.text };
  };

  private resolveOnce = async (input: { sessionId: string; questionId: string; action: "answer" | "dismiss"; answer?: string }): Promise<UserQuestionResolution> => {
    const prepared = await this.prepareResolution(input);
    if (!prepared.payload) return { question: prepared.question, handle: null };
    const handle = await this.ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: prepared.payload,
    }, { source: "user-question" });
    const updated = (await this.list(input.sessionId)).find(({ id }) => id === prepared.question.id);
    return { question: updated ?? prepared.question, handle };
  };

  private prepareResolution = async (input: { sessionId: string; questionId: string; action: "answer" | "dismiss"; answer?: string }): Promise<{ question: UserQuestionView; payload: AgentRunSendIngressPayload | null }> => {
    await this.assertNativeSession(input.sessionId);
    const answer = input.answer?.trim();
    if (input.action === "answer" && !answer) {
      throw new UserQuestionError("INVALID_ANSWER", "Answer must be non-empty.");
    }
    const question = (await this.list(input.sessionId)).find(({ id }) => id === input.questionId);
    if (!question) throw new UserQuestionError("NOT_FOUND", "Question not found in this session.");
    if (question.status !== "pending") {
      if (question.status !== (input.action === "answer" ? "answered" : "dismissed") ||
          (input.action === "answer" && question.answer !== answer)) {
        throw new UserQuestionError("CONFLICT", "This question has already been resolved differently.");
      }
      return { question, payload: null };
    }
    const message = createQuestionResolutionMessage(input.sessionId, question, input.action, answer);
    const payload: AgentRunSendIngressPayload = {
      sessionId: input.sessionId,
      message,
      delivery: "prefer-steer",
      idempotencyKey: `user-question:${question.id}`,
    };
    return { question, payload };
  };

  private assertNativeSession = async (sessionId: string): Promise<void> => {
    const session = await this.sessions.getSession(sessionId);
    if (!session) throw new UserQuestionError("NOT_FOUND", "Session not found.");
    const runSession = await this.sessions.getAgentRunSession(sessionId);
    if (runSession.agentRuntimeId !== "native") {
      throw new UserQuestionError("UNSUPPORTED_RUNTIME", "Async questions are available for native agents only.");
    }
  };
}
