import type { BiboChatEvent, BiboMessage, BiboSession, BiboUser } from "../types/bibo-client.types";

const MAX_FRAME_LENGTH = 4_000_000;

export class BiboClientError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "BiboClientError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readUser(value: unknown): BiboUser {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.email !== "string") {
    throw new BiboClientError("账号服务返回了无效的数据。");
  }
  return { id: value.id, email: value.email };
}

export function readMessages(value: unknown): BiboMessage[] {
  if (!Array.isArray(value) || !value.every((item) => isRecord(item)
    && (item.role === "user" || item.role === "assistant")
    && typeof item.text === "string" && typeof item.at === "string")) {
    throw new BiboClientError("对话记录格式不正确。");
  }
  return value.map((item) => ({ role: item.role, text: item.text, at: item.at }));
}

export function readSession(value: unknown): BiboSession {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.updatedAt !== "string") {
    throw new BiboClientError("会话信息格式不正确。");
  }
  return { id: value.id, title: value.title, updatedAt: value.updatedAt,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : value.updatedAt,
    ...(typeof value.messageCount === "number" ? { messageCount: value.messageCount } : {}) };
}

export function readCommitted(value: unknown): Extract<BiboChatEvent, { name: "committed" }> {
  if (!isRecord(value) || typeof value.text !== "string") {
    throw new BiboClientError("回答没有保存，请重试。");
  }
  return { name: "committed", value: { text: value.text, messages: readMessages(value.messages), session: value.session === undefined || value.session === null ? null : readSession(value.session) } };
}

function readFrame(frame: string): BiboChatEvent | null {
  let name = "";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) name = line.slice(6).trimStart();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!name || !data.length) return null;
  if (!["accepted", "delta", "saving", "committed", "error"].includes(name)) return null;
  let value: unknown;
  try { value = JSON.parse(data.join("\n")) as unknown; }
  catch { throw new BiboClientError("回答数据格式不正确。"); }
  if (name === "error") {
    throw new BiboClientError(isRecord(value) && typeof value.error === "string"
      ? value.error : "Bibo 暂时无法完成这次任务。");
  }
  if (name === "accepted" && isRecord(value) && typeof value.runId === "string") {
    return { name, value: { runId: value.runId } };
  }
  if (name === "delta" && isRecord(value) && typeof value.text === "string") {
    return { name, value: { text: value.text } };
  }
  if (name === "saving" && isRecord(value)) return { name, value: {} };
  if (name === "committed") return readCommitted(value);
  throw new BiboClientError("回答事件格式不正确。");
}

export async function readBiboStream(response: Response, onEvent: (event: BiboChatEvent) => void): Promise<void> {
  if (!response.body) throw new BiboClientError("连接中断，无法确认回答是否保存。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let committed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (frame.length > MAX_FRAME_LENGTH) throw new BiboClientError("回答数据过长。");
        const event = readFrame(frame);
        if (!event) continue;
        if (committed) throw new BiboClientError("回答提交后仍收到事件。");
        onEvent(event);
        if (event.name === "committed") committed = true;
      }
      if (buffer.length > MAX_FRAME_LENGTH) throw new BiboClientError("回答数据过长。");
      if (done) {
        if (buffer.trim() || !committed) throw new BiboClientError("连接中断，无法确认回答是否保存。");
        return;
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
