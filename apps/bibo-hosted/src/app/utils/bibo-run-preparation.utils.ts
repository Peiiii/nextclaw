import { publicError } from "../bibo-auth.utils";
import type { BiboSession } from "./bibo-session.utils";

export type PreparedBiboRun = { message: string; token: string; userId?: string; clientRequestId?: string; session: BiboSession;
  question?: { id: string; title: string; action: "answer" | "dismiss" } };

export async function prepareBiboRun(request: Request, storage: DurableObjectStorage): Promise<PreparedBiboRun | Response> {
  const payload = await request.json() as { message?: unknown; token?: unknown; userId?: unknown; sessionId?: unknown;
    questionId?: unknown; questionAction?: unknown; clientRequestId?: unknown };
  if (typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 4000 || typeof payload.token !== "string") {
    return publicError("请输入 1 到 4000 字的消息。", 400);
  }
  if (payload.clientRequestId !== undefined &&
    (typeof payload.clientRequestId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(payload.clientRequestId))) {
    return publicError("请求编号不正确。", 400);
  }
  if (payload.clientRequestId && await storage.get(`edgeRunReceipt:${payload.clientRequestId}`)) {
    return publicError("这条消息已经保存，请刷新会话。", 409);
  }
  const sessions = await storage.get<BiboSession[]>("sessions") ?? [];
  const session = typeof payload.sessionId === "string" ? sessions.find((item) => item.id === payload.sessionId) : sessions[0];
  if (payload.sessionId && !session) return publicError("会话不存在。", 404);
  let question: PreparedBiboRun["question"];
  if (payload.questionId !== undefined) {
    if (typeof payload.questionId !== "string" || !payload.questionId ||
      (payload.questionAction !== "answer" && payload.questionAction !== "dismiss") || !session) return publicError("问题编号不正确。", 400);
    const found = session.messages.flatMap((message) => message.questions ?? []).find((item) => item.id === payload.questionId);
    if (!found || found.status !== "pending") return publicError("这个问题已经处理，请刷新会话。", 409);
    question = { id: found.id, title: found.title, action: payload.questionAction };
  }
  const now = Date.now();
  const recent = (await storage.get<number[]>("runs") ?? []).filter((at) => now - at < 3_600_000);
  if (recent.length >= 100) return publicError("本小时对话次数已用完，请稍后再来。", 429);
  await storage.put("runs", [...recent, now]);
  const time = new Date().toISOString();
  return { message: payload.message.trim(), token: payload.token,
    ...(typeof payload.clientRequestId === "string" ? { clientRequestId: payload.clientRequestId } : {}),
    ...(typeof payload.userId === "string" ? { userId: payload.userId } : {}),
    session: session ?? { id: crypto.randomUUID(), title: "新对话", createdAt: time, updatedAt: time, messages: [] },
    ...(question ? { question } : {}) };
}
