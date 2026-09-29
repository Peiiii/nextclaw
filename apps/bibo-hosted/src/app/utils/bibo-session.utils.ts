import type { BiboMessage } from "@nextclaw/bibo-client";
import type { RunResult } from "../bibo-run-stream.utils";

export type BiboSession = { id: string; title: string; createdAt: string; updatedAt: string; messages: BiboMessage[] };

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
    ...(newQuestions.length ? { questions: newQuestions } : {}) };
  const updated: BiboSession = { ...payload.session,
    title: payload.session.messages.length === 0 && payload.session.title === "新对话" ? payload.message.slice(0, 40) : payload.session.title,
    updatedAt: at, messages: [...retained, userMessage, assistantMessage] };
  return { sessions: [updated, ...sessions.filter((item) => item.id !== updated.id)],
    response: { text: result.text, messages: updated.messages, displayEvents: result.displayEvents ?? [],
      session: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt } } };
}
