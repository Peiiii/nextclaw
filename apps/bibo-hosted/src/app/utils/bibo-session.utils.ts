import { isHiddenNcpMessage, type NcpMessage } from "@nextclaw/ncp";
import { projectUserQuestions } from "@nextclaw/kernel";
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

export function projectBiboConversation(messages: readonly NcpMessage[]): BiboMessage[] {
  const visible = messages.filter((message) => !isHiddenNcpMessage(message) && message.status === "final");
  const questions = projectUserQuestions(visible);
  const result: BiboMessage[] = [];
  let assistant: NcpMessage[] = [];
  const flushAssistant = () => {
    if (!assistant.length) return;
    const { text, content } = projectBiboRunContent([], assistant);
    const ids = new Set(content.flatMap((part) => part.type === "questions" ? part.ids : []));
    if (text || ids.size) result.push({ role: "assistant", text, content,
      at: assistant.at(-1)!.timestamp, ...(ids.size ? { questions: questions.filter((question) => ids.has(question.id)) } : {}) });
    assistant = [];
  };
  for (const message of visible) {
    if (message.role === "assistant") { assistant.push(message); continue; }
    if (message.role !== "user") continue;
    flushAssistant();
    const metadata = message.metadata ?? {};
    const action = metadata.nextclaw_user_question_action;
    const questionId = metadata.nextclaw_user_question_id;
    const reply: BiboMessage["replyToQuestion"] = typeof questionId === "string" && (action === "answered" || action === "dismissed")
      ? { id: questionId, title: String(metadata.nextclaw_user_question_title ?? ""), action } : undefined;
    const text = reply ? reply.action === "dismissed" ? "跳过" : String(metadata.nextclaw_user_question_answer ?? "")
      : message.parts.flatMap((part) => part.type === "text" || part.type === "rich-text" ? [part.text] : []).join("\n");
    result.push({ role: "user", text, at: message.timestamp, ...(reply ? { replyToQuestion: reply } : {}) });
  }
  flushAssistant();
  return result;
}

export function prepareBiboSessionRun(sessions: BiboSession[], payload: { message: string; session: BiboSession;
  question?: { id: string; title: string; action: "answer" | "dismiss" } }, result: RunResult, history: readonly NcpMessage[]): {
  sessions: BiboSession[]; response: Record<string, unknown>;
} {
  const at = new Date().toISOString();
  const messages = projectBiboConversation(history);
  const updated: BiboSession = { ...payload.session,
    title: payload.session.messages.length === 0 && payload.session.title === "新对话" ? payload.message.slice(0, 40) : payload.session.title,
    updatedAt: at, messages: [] };
  return { sessions: [updated, ...sessions.filter((item) => item.id !== updated.id)],
    response: { text: result.text, messages, displayEvents: result.displayEvents ?? [],
      session: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt } } };
}
