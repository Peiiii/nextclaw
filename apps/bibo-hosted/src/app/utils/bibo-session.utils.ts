import type { NcpMessage } from "@nextclaw/ncp";
import type { BiboMessage, BiboMessageContent } from "@nextclaw/bibo-client";
import type { RunResult } from "../bibo-run-stream.utils";

export type BiboSession = { id: string; title: string; createdAt: string; updatedAt: string; messages: BiboMessage[] };

function questionIds(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const ids = (value as { accepted?: unknown; questionIds?: unknown }).questionIds;
  return (value as { accepted?: unknown }).accepted === true && Array.isArray(ids) && ids.every((id) => typeof id === "string")
    ? ids : [];
}

function extensionQuestions(part: NcpMessage["parts"][number]): Array<{ id: string; title: string; options?: string[] }> {
  if (part.type !== "extension" || part.extensionType !== "nextclaw.user-question") return [];
  const entries = part.data && typeof part.data === "object" && "questions" in part.data ? part.data.questions : null;
  return Array.isArray(entries) ? entries.filter((entry): entry is { id: string; title: string; options?: string[] } =>
    Boolean(entry && typeof entry.id === "string" && typeof entry.title === "string")) : [];
}

export function projectBiboRunContent(before: readonly NcpMessage[], after: readonly NcpMessage[]): { text: string; content: BiboMessageContent[] } {
  const knownMessages = new Set(before.map((message) => message.id));
  const assistantMessages = after.filter((message) => !knownMessages.has(message.id) && message.role === "assistant" && message.status === "final");
  const knownQuestions = new Set(assistantMessages.flatMap((message) => message.parts.flatMap((part) => extensionQuestions(part).map((item) => item.id))));
  const anchoredQuestions = new Set(assistantMessages.flatMap((message) => message.parts.flatMap((part) =>
    part.type === "tool-invocation" && part.toolName === "request_user_input_async"
      ? questionIds(part.result).filter((id) => knownQuestions.has(id)) : [])));
  const content: BiboMessageContent[] = [];
  for (const message of assistantMessages) {
    for (let index = 0; index < message.parts.length; index += 1) {
      const part = message.parts[index]!;
      if (part.type === "text" && part.text) {
        const nextQuestions = extensionQuestions(message.parts[index + 1] ?? part);
        const fallback = nextQuestions.map((item) => `${item.title}${item.options?.length ? ` (${item.options.join(" / ")})` : ""}`).join("\n");
        if (part.text !== fallback || !nextQuestions.length) content.push({ type: "text", text: part.text });
      }
      if (part.type === "tool-invocation" && part.toolName === "request_user_input_async") {
        const ids = questionIds(part.result).filter((id) => knownQuestions.has(id));
        if (ids.length) content.push({ type: "questions", ids });
      }
      const unanchored = extensionQuestions(part).map((item) => item.id).filter((id) => !anchoredQuestions.has(id));
      if (unanchored.length) content.push({ type: "questions", ids: unanchored });
    }
  }
  return { content, text: content.filter((part): part is Extract<BiboMessageContent, { type: "text" }> => part.type === "text")
    .map((part) => part.text).join("\n\n") };
}

export function prepareBiboSessionRun(sessions: BiboSession[], payload: { message: string; session: BiboSession;
  question?: { id: string; title: string; action: "answer" | "dismiss" } }, result: RunResult): {
  sessions: BiboSession[]; response: Record<string, unknown>;
} {
  const at = new Date().toISOString();
  const questions = result.questions ?? [];
  const projected = payload.session.messages.map((message) => message.questions?.length
    ? { ...message, questions: message.questions.map((question) => questions.find((latest) => latest.id === question.id) ?? question) }
    : message);
  const knownIds = new Set(projected.flatMap((message) => message.questions?.map((question) => question.id) ?? []));
  const newQuestions = questions.filter((question) => !knownIds.has(question.id));
  const retained = projected.filter((message, index) => index >= projected.length - 98 || message.questions?.some((question) => question.status === "pending"));
  const userMessage: BiboMessage = { role: "user", text: payload.question?.action === "dismiss" ? "跳过" : payload.message, at,
    ...(payload.question ? { replyToQuestion: { id: payload.question.id, title: payload.question.title,
      action: payload.question.action === "answer" ? "answered" as const : "dismissed" as const } } : {}) };
  const assistantMessage: BiboMessage = { role: "assistant", text: result.text, at,
    ...(result.content ? { content: result.content } : {}),
    ...(newQuestions.length ? { questions: newQuestions } : {}) };
  const updated: BiboSession = { ...payload.session,
    title: payload.session.messages.length === 0 && payload.session.title === "新对话" ? payload.message.slice(0, 40) : payload.session.title,
    updatedAt: at, messages: [...retained, userMessage, assistantMessage] };
  return { sessions: [updated, ...sessions.filter((item) => item.id !== updated.id)],
    response: { text: result.text, messages: updated.messages, displayEvents: result.displayEvents ?? [],
      session: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt } } };
}
