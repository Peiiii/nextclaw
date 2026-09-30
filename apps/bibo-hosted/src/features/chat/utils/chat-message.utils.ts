import { biboCopy } from "@/shared/configs/bibo-copy.config";
import type { BiboMessage } from "@nextclaw/bibo-client";

export type BiboDisplayMessage = BiboMessage & { id: string; pending?: boolean };
export function identifyMessages(messages: BiboMessage[], previous: BiboDisplayMessage[], pendingIds: [string, string] | null = null): BiboDisplayMessage[] {
  const existing = new Map(previous.map(message => [`${message.role}:${message.at}`, message]));
  return messages.map((message, index) => {
    const previous = existing.get(`${message.role}:${message.at}`);
    if (previous?.text === message.text && JSON.stringify(previous.content) === JSON.stringify(message.content) && JSON.stringify(previous.questions) === JSON.stringify(message.questions) &&
      JSON.stringify(previous.replyToQuestion) === JSON.stringify(message.replyToQuestion)) return previous;
    const pendingId = pendingIds && index >= messages.length - 2 ? pendingIds[index - (messages.length - 2)] : undefined;
    return { ...message, id: previous?.id ?? pendingId ?? crypto.randomUUID() };
  });
}

export function messageTime(at: string, previous?: string, now = new Date()): string | null {
  const date = new Date(at);
  if (!at || !Number.isFinite(date.getTime())) return null;
  const prior = previous ? new Date(previous) : null;
  if (prior && date.toDateString() === prior.toDateString() && date.getTime() - prior.getTime() < 300_000) return null;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const day = date.toDateString() === now.toDateString() ? biboCopy.today
    : date.toDateString() === yesterday.toDateString() ? biboCopy.yesterday
    : date.toLocaleDateString("zh-CN", { ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}), month: "long", day: "numeric" });
  return `${day} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
