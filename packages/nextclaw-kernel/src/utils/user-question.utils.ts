import type { NcpMessage } from "@nextclaw/ncp";

export const USER_QUESTION_EXTENSION_TYPE = "nextclaw.user-question";
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

export function createQuestionMessage(sessionId: string, prompts: readonly UserQuestionPrompt[]): { message: NcpMessage; questionIds: string[] } {
  if (prompts.length < 1 || prompts.length > 3) throw new Error("Provide one to three questions.");
  const questions = prompts.map((prompt) => ({
    id: crypto.randomUUID(), title: prompt.title.trim(),
    ...(prompt.options ? { options: prompt.options.map((option) => option.trim()) } : {}),
    ...(prompt.recommendedOption ? { recommendedOption: prompt.recommendedOption.trim() } : {}),
    ...(prompt.optionDescriptions ? { optionDescriptions: Object.fromEntries(Object.entries(prompt.optionDescriptions).map(([option, description]) => [option.trim(), description.trim()])) } : {}),
  }));
  if (questions.some((question) => !question.title || question.options?.some((option) => !option) ||
    (question.recommendedOption !== undefined && (!question.recommendedOption || !question.options?.includes(question.recommendedOption))) ||
    (question.optionDescriptions && Object.entries(question.optionDescriptions).some(([option, description]) => !question.options?.includes(option) || !description)))) {
    throw new Error("Question titles, options, recommendations, and option descriptions must be valid.");
  }
  const message: NcpMessage = {
    id: `assistant-question-${crypto.randomUUID()}`, sessionId, role: "assistant", status: "final",
    timestamp: new Date().toISOString(),
    parts: [
      { type: "text", text: questions.map((question) => `${question.title}${question.options?.length ? ` (${question.options.join(" / ")})` : ""}`).join("\n") },
      { type: "extension", extensionType: USER_QUESTION_EXTENSION_TYPE, data: { questions } },
    ],
  };
  return { message, questionIds: questions.map((question) => question.id) };
}

export function projectUserQuestions(messages: readonly NcpMessage[]): UserQuestionView[] {
  const questions = new Map<string, UserQuestionView>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (part.type !== "extension" || part.extensionType !== USER_QUESTION_EXTENSION_TYPE) continue;
      const data = part.data;
      const entries = data && typeof data === "object" && "questions" in data ? data.questions : null;
      if (!Array.isArray(entries)) continue;
      for (const raw of entries) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const { id, title, options, recommendedOption, optionDescriptions } = raw as Record<string, unknown>;
        if (typeof id !== "string" || !id || typeof title !== "string" || !title) continue;
        const validOptions = Array.isArray(options) && options.every((option) => typeof option === "string") ? options as string[] : undefined;
        questions.set(id, { id, title,
          ...(validOptions ? { options: validOptions } : {}),
          ...(typeof recommendedOption === "string" && validOptions?.includes(recommendedOption) ? { recommendedOption } : {}),
          ...(optionDescriptions && typeof optionDescriptions === "object" && !Array.isArray(optionDescriptions) && validOptions
            ? { optionDescriptions: Object.fromEntries(Object.entries(optionDescriptions).filter(([option, description]) =>
              validOptions.includes(option) && typeof description === "string" && description.trim())) as Record<string, string> }
            : {}),
          messageId: message.id, askedAt: message.timestamp, status: "pending" });
      }
    }
  }
  for (const message of messages) {
    if (message.role !== "user") continue;
    const id = message.metadata?.nextclaw_user_question_id;
    const action = message.metadata?.nextclaw_user_question_action;
    if (typeof id !== "string" || (action !== "answered" && action !== "dismissed")) continue;
    const question = questions.get(id);
    if (!question || question.status !== "pending") continue;
    const saved = message.metadata?.nextclaw_user_question_answer;
    const fallback = message.parts.find((part) => part.type === "text");
    const answer = typeof saved === "string" ? saved : fallback?.type === "text" ? fallback.text : undefined;
    questions.set(id, { ...question, status: action, answerMessageId: message.id,
      ...(answer ? { answer } : {}) });
  }
  return [...questions.values()];
}

export function createQuestionResolutionMessage(sessionId: string, question: UserQuestionView, action: "answer" | "dismiss", answer?: string): NcpMessage {
  const normalized = answer?.trim();
  if (action === "answer" && !normalized) throw new Error("Answer must be non-empty.");
  const status = action === "answer" ? "answered" : "dismissed";
  const text = status === "answered"
    ? `[Reply to an earlier question]\nQuestion ID: ${question.id}\nQuestion: ${question.title}\nAnswer: ${normalized}`
    : `[Skipped an earlier question]\nQuestion ID: ${question.id}\nQuestion: ${question.title}`;
  return {
    id: `user-question-resolution-${question.id}`, sessionId, role: "user", status: "final", timestamp: new Date().toISOString(),
    parts: [{ type: "text", text }],
    metadata: {
      nextclaw_user_question_id: question.id,
      nextclaw_user_question_action: status,
      nextclaw_user_question_title: question.title,
      nextclaw_user_question_message_id: question.messageId,
      ...(status === "answered" ? { nextclaw_user_question_answer: normalized } : {}),
    },
  };
}
