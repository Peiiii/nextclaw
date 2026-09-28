import { randomUUID } from "node:crypto";
import { NcpEventType, type NcpMessage, type NcpRunHandle } from "@nextclaw/ncp";
import { ingressKeys, type AgentRunSendIngressPayload, type Ingress } from "@nextclaw/shared";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type { AgentRunClient, AgentRunReplyOptions } from "@kernel/services/agent-run-client.service.js";

export const USER_QUESTION_EXTENSION_TYPE = "nextclaw.user-question";
const QUESTION_ID_METADATA_KEY = "nextclaw_user_question_id";
const QUESTION_ACTION_METADATA_KEY = "nextclaw_user_question_action";
const QUESTION_ANSWER_METADATA_KEY = "nextclaw_user_question_answer";
const QUESTION_TITLE_METADATA_KEY = "nextclaw_user_question_title";
const QUESTION_MESSAGE_ID_METADATA_KEY = "nextclaw_user_question_message_id";

export type UserQuestionPrompt = {
  title: string;
  options?: string[];
  recommendedOption?: string;
  optionDescriptions?: Record<string, string>;
};

export type UserQuestionView = UserQuestionPrompt & {
  id: string;
  messageId: string;
  askedAt: string;
  status: "pending" | "answered" | "dismissed";
  answer?: string;
  answerMessageId?: string;
};

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

function readQuestionData(value: unknown): Array<{ id: string } & UserQuestionPrompt> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const questions = (value as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return [];
  return questions.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const { id, title, options, recommendedOption, optionDescriptions } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !id || typeof title !== "string" || !title) return [];
    return [{
      id,
      title,
      ...(Array.isArray(options) && options.every((option) => typeof option === "string")
        ? { options: options as string[] }
        : {}),
      ...(typeof recommendedOption === "string" && Array.isArray(options) &&
        options.every((option) => typeof option === "string") && options.includes(recommendedOption)
        ? { recommendedOption }
        : {}),
      ...(optionDescriptions && typeof optionDescriptions === "object" && !Array.isArray(optionDescriptions) && Array.isArray(options)
        ? { optionDescriptions: Object.fromEntries(Object.entries(optionDescriptions).filter(([option, description]) =>
          options.includes(option) && typeof description === "string" && description.trim())) as Record<string, string> }
        : {}),
    }];
  });
}

function readResolution(message: NcpMessage): { questionId: string; action: "answered" | "dismissed"; answer?: string } | null {
  if (message.role !== "user") return null;
  const questionId = message.metadata?.[QUESTION_ID_METADATA_KEY];
  const action = message.metadata?.[QUESTION_ACTION_METADATA_KEY];
  if (typeof questionId !== "string" || (action !== "answered" && action !== "dismissed")) return null;
  const answer = message.metadata?.[QUESTION_ANSWER_METADATA_KEY];
  const fallback = message.parts.find((part) => part.type === "text");
  return {
    questionId,
    action,
    ...(action === "answered"
      ? { answer: typeof answer === "string" ? answer : fallback?.type === "text" ? fallback.text : undefined }
      : {}),
  };
}

function projectQuestions(messages: readonly NcpMessage[]): UserQuestionView[] {
  const questions = new Map<string, UserQuestionView>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (part.type !== "extension" || part.extensionType !== USER_QUESTION_EXTENSION_TYPE) continue;
      for (const question of readQuestionData(part.data)) {
        questions.set(question.id, {
          ...question,
          messageId: message.id,
          askedAt: message.timestamp,
          status: "pending",
        });
      }
    }
  }
  for (const message of messages) {
    const resolution = readResolution(message);
    if (!resolution) continue;
    const question = questions.get(resolution.questionId);
    if (!question || question.status !== "pending") continue;
    questions.set(resolution.questionId, {
      ...question,
      status: resolution.action,
      answerMessageId: message.id,
      ...(resolution.answer ? { answer: resolution.answer } : {}),
    });
  }
  return [...questions.values()];
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
    if (prompts.length < 1 || prompts.length > 3) {
      throw new UserQuestionError("INVALID_ANSWER", "Provide one to three questions.");
    }
    const questions = prompts.map((prompt) => ({
      id: randomUUID(),
      title: prompt.title.trim(),
      ...(prompt.options ? { options: prompt.options.map((option) => option.trim()) } : {}),
      ...(prompt.recommendedOption ? { recommendedOption: prompt.recommendedOption.trim() } : {}),
      ...(prompt.optionDescriptions ? { optionDescriptions: Object.fromEntries(Object.entries(prompt.optionDescriptions).map(([option, description]) =>
        [option.trim(), description.trim()])) } : {}),
    }));
    if (questions.some((question) => !question.title || question.options?.some((option) => !option) ||
      (question.recommendedOption !== undefined && (!question.recommendedOption || !question.options?.includes(question.recommendedOption))) ||
      (question.optionDescriptions && Object.entries(question.optionDescriptions).some(([option, description]) =>
        !question.options?.includes(option) || !description)))) {
      throw new UserQuestionError("INVALID_ANSWER", "Question titles, options, recommendations, and option descriptions must be valid.");
    }
    const timestamp = new Date().toISOString();
    const message: NcpMessage = {
      id: `assistant-question-${randomUUID()}`,
      sessionId,
      role: "assistant",
      status: "final",
      timestamp,
      parts: [
        { type: "text", text: questions.map((question) => `${question.title}${question.options?.length ? ` (${question.options.join(" / ")})` : ""}`).join("\n") },
        { type: "extension", extensionType: USER_QUESTION_EXTENSION_TYPE, data: { questions } },
      ],
    };
    const event = {
      type: NcpEventType.MessageSent as const,
      occurredAt: timestamp,
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
    return { accepted: true, questionIds: questions.map((question) => question.id) };
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
    return projectQuestions([...messages.values()]);
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
    const action = input.action === "answer" ? "answered" : "dismissed";
    const text = action === "answered"
      ? `[Reply to an earlier question]\nQuestion ID: ${question.id}\nQuestion: ${question.title}\nAnswer: ${answer}`
      : `[Skipped an earlier question]\nQuestion ID: ${question.id}\nQuestion: ${question.title}`;
    const message: NcpMessage = {
      id: `user-question-resolution-${question.id}`,
      sessionId: input.sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text }],
      metadata: {
        [QUESTION_ID_METADATA_KEY]: question.id,
        [QUESTION_ACTION_METADATA_KEY]: action,
        [QUESTION_TITLE_METADATA_KEY]: question.title,
        [QUESTION_MESSAGE_ID_METADATA_KEY]: question.messageId,
        ...(action === "answered" ? { [QUESTION_ANSWER_METADATA_KEY]: answer } : {}),
      },
    };
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
