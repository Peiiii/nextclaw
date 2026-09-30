import type { BiboChatEvent, BiboMessage, BiboMessageContent, BiboQuestion, BiboQuestionReference, BiboRunSnapshot, BiboRunState, BiboSession, BiboShowContent, BiboTextBlock, BiboUser } from "../types/bibo-client.types";
import type { BiboFileDetail } from "../types/bibo-space.types";

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

export function appendBiboTextBlock(blocks: BiboTextBlock[], text: string, blockId = "answer"): BiboTextBlock[] {
  if (!text) return blocks;
  const last = blocks.at(-1);
  return last?.id === blockId
    ? [...blocks.slice(0, -1), { id: blockId, text: last.text + text }]
    : [...blocks, { id: blockId, text }];
}

export function readRunSnapshot(value: unknown): BiboRunSnapshot {
  if (!isRecord(value) || typeof value.runId !== "string" || !value.runId || typeof value.sessionId !== "string" || !value.sessionId ||
    typeof value.message !== "string" || !["generating", "saving", "completed", "failed"].includes(String(value.phase)) ||
    typeof value.startedAt !== "number" || !Number.isFinite(value.startedAt) || typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) ||
    typeof value.partial !== "string" || (value.activity !== undefined && typeof value.activity !== "string") ||
    (value.partialBlocks !== undefined && (!Array.isArray(value.partialBlocks) || !value.partialBlocks.every(block =>
      isRecord(block) && typeof block.id === "string" && block.id.trim() && typeof block.text === "string"))) ||
    (value.clientRequestId !== undefined && typeof value.clientRequestId !== "string") ||
    (value.error !== undefined && (!isRecord(value.error) || typeof value.error.code !== "string" || typeof value.error.message !== "string"))) {
    throw new BiboClientError("任务状态格式不正确。");
  }
  return { runId: value.runId, sessionId: value.sessionId, message: value.message,
    phase: value.phase as BiboRunSnapshot["phase"], startedAt: value.startedAt, updatedAt: value.updatedAt, partial: value.partial,
    ...(value.partialBlocks === undefined ? {} : { partialBlocks: value.partialBlocks as BiboTextBlock[] }),
    ...(value.activity === undefined ? {} : { activity: value.activity as string }),
    ...(value.clientRequestId === undefined ? {} : { clientRequestId: value.clientRequestId as string }),
    ...(value.error === undefined ? {} : { error: value.error as BiboRunSnapshot["error"] }) };
}
export function readRunState(value: unknown): BiboRunState {
  if (!isRecord(value) || !Array.isArray(value.activeRuns)) throw new BiboClientError("任务状态格式不正确。");
  return { run: value.run === null ? null : readRunSnapshot(value.run), activeRuns: value.activeRuns.map(readRunSnapshot) };
}

export function readShowContent(value: unknown): BiboShowContent {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()
    || typeof value.sessionId !== "string" || !value.sessionId.trim()
    || (value.title !== undefined && typeof value.title !== "string")
    || !isRecord(value.target) || value.target.type !== "file"
    || !isRecord(value.target.payload) || typeof value.target.payload.path !== "string" || !value.target.payload.path
    || (value.target.payload.viewer !== undefined && !["auto", "source", "rendered"].includes(String(value.target.payload.viewer)))) {
    throw new BiboClientError("文件展示事件格式不正确。");
  }
  return { id: value.id, sessionId: value.sessionId, ...(typeof value.title === "string" ? { title: value.title } : {}),
    target: { type: "file", payload: { path: value.target.payload.path,
      ...(value.target.payload.viewer === undefined ? {} : { viewer: value.target.payload.viewer as "auto" | "source" | "rendered" }) } } };
}

function readFilePreview(value: unknown): BiboFileDetail["preview"] {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.totalBytes !== "number" || !Number.isSafeInteger(value.totalBytes)
    || typeof value.readBytes !== "number" || !Number.isSafeInteger(value.readBytes)
    || value.readBytes < 0 || value.totalBytes < value.readBytes
    || typeof value.binary !== "boolean" || typeof value.truncated !== "boolean"
    || value.truncated !== (value.readBytes < value.totalBytes)) {
    throw new BiboClientError("文件预览信息不正确。");
  }
  return { totalBytes: value.totalBytes, readBytes: value.readBytes, truncated: value.truncated, binary: value.binary };
}

export function readFileDetail(value: unknown): BiboFileDetail {
  const preview = isRecord(value) ? readFilePreview(value.preview) : undefined;
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || typeof value.path !== "string" || !value.path
    || !["folder", "note", "document", "artifact"].includes(String(value.kind))
    || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string"
    || !(typeof value.version === "string" ? value.version.trim().length > 0
      : Number.isSafeInteger(value.version) && Number(value.version) >= 1)
    || typeof value.uri !== "string" || !value.uri
    || (value.kind === "folder" || preview?.binary ? value.content !== null : typeof value.content !== "string")) {
    throw new BiboClientError("文件详情格式不正确。");
  }
  return { id: value.id, path: value.path, kind: value.kind as BiboFileDetail["kind"],
    createdAt: value.createdAt, updatedAt: value.updatedAt, version: value.version as number | string,
    uri: value.uri, content: value.content as string | null, ...(preview ? { preview } : {}) };
}

export function readUser(value: unknown): BiboUser {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.email !== "string") {
    throw new BiboClientError("账号服务返回了无效的数据。");
  }
  return { id: value.id, email: value.email };
}

export function readQuestions(value: unknown): BiboQuestion[] {
  if (!Array.isArray(value)) throw new BiboClientError("问题数据格式不正确。");
  return value.map((item): BiboQuestion => {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || typeof item.title !== "string" || !item.title ||
      typeof item.messageId !== "string" || typeof item.askedAt !== "string" ||
      !["pending", "answered", "dismissed"].includes(String(item.status)) ||
      (item.options !== undefined && (!Array.isArray(item.options) || !item.options.every((option) => typeof option === "string" && option))) ||
      (item.recommendedOption !== undefined && (typeof item.recommendedOption !== "string" || !Array.isArray(item.options) || !item.options.includes(item.recommendedOption))) ||
      (item.optionDescriptions !== undefined && (!isRecord(item.optionDescriptions) || !Object.entries(item.optionDescriptions).every(([option, description]) =>
        Array.isArray(item.options) && item.options.includes(option) && typeof description === "string" && description))) ||
      (item.answer !== undefined && typeof item.answer !== "string")) throw new BiboClientError("问题数据格式不正确。");
    return { id: item.id, title: item.title, messageId: item.messageId, askedAt: item.askedAt,
      status: item.status as BiboQuestion["status"],
      ...(item.options ? { options: item.options as string[] } : {}),
      ...(typeof item.recommendedOption === "string" ? { recommendedOption: item.recommendedOption } : {}),
      ...(item.optionDescriptions ? { optionDescriptions: item.optionDescriptions as Record<string, string> } : {}),
      ...(typeof item.answer === "string" ? { answer: item.answer } : {}) };
  });
}

function readQuestionReference(value: unknown): BiboQuestionReference {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || typeof value.title !== "string" || !value.title ||
    (value.action !== "answered" && value.action !== "dismissed")) throw new BiboClientError("问题引用格式不正确。");
  return { id: value.id, title: value.title, action: value.action };
}

export function readMessageContent(value: unknown): BiboMessageContent[] {
  if (!Array.isArray(value)) throw new BiboClientError("对话内容格式不正确。");
  return value.map((part): BiboMessageContent => {
    if (!isRecord(part)) throw new BiboClientError("对话内容格式不正确。");
    if (part.type === "text" && typeof part.text === "string" && part.text) return { type: "text", text: part.text };
    if (part.type === "questions" && Array.isArray(part.ids) && part.ids.length &&
      part.ids.every((id) => typeof id === "string" && id)) return { type: "questions", ids: part.ids as string[] };
    throw new BiboClientError("对话内容格式不正确。");
  });
}

export function readMessages(value: unknown): BiboMessage[] {
  if (!Array.isArray(value) || !value.every((item) => isRecord(item)
    && (item.role === "user" || item.role === "assistant")
    && typeof item.text === "string" && typeof item.at === "string")) {
    throw new BiboClientError("对话记录格式不正确。");
  }
  return value.map((item) => ({ role: item.role, text: item.text, at: item.at,
    ...(item.content === undefined ? {} : { content: readMessageContent(item.content) }),
    ...(item.questions === undefined ? {} : { questions: readQuestions(item.questions) }),
    ...(item.replyToQuestion === undefined ? {} : { replyToQuestion: readQuestionReference(item.replyToQuestion) }) }));
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
  if (!["accepted", "snapshot", "delta", "saving", "committed", "error", "show-content"].includes(name)) return null;
  let value: unknown;
  try { value = JSON.parse(data.join("\n")) as unknown; }
  catch { throw new BiboClientError("回答数据格式不正确。"); }
  if (name === "snapshot") return { name, value: readRunSnapshot(value) };
  if (name === "show-content") return { name, value: readShowContent(value) };
  if (name === "error") {
    throw new BiboClientError(isRecord(value) && typeof value.error === "string"
      ? value.error : "Bibo 暂时无法完成这次任务。");
  }
  if (name === "accepted" && isRecord(value) && typeof value.runId === "string") {
    return { name, value: { runId: value.runId } };
  }
  if (name === "delta" && isRecord(value) && typeof value.text === "string") {
    if (value.blockId !== undefined && (typeof value.blockId !== "string" || !value.blockId.trim())) throw new BiboClientError("回答片段格式不正确。");
    return { name, value: { text: value.text, ...(typeof value.blockId === "string" ? { blockId: value.blockId } : {}) } };
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
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const { done, value } = await Promise.race([reader.read(), new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new BiboClientError("连接暂时中断，正在恢复任务状态。")), 45_000);
      })]).finally(() => clearTimeout(timeout));
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
