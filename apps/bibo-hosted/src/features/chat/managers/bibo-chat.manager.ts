import type { BiboMessage, BiboUser, ChatEvent } from "@/features/chat/types/bibo-chat.types";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    credentials: "same-origin",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `请求失败 (${response.status})`);
  return value;
}

async function readEvents(response: Response, onEvent: (event: ChatEvent) => void): Promise<void> {
  if (!response.body) throw new Error("连接中断，无法确认回答是否保存。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let boundary: number;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const name = frame.match(/^event: (.+)$/m)?.[1];
        const data = frame.match(/^data: (.+)$/m)?.[1];
        if (name && data) onEvent({ name, value: JSON.parse(data) } as ChatEvent);
      }
      if (done) break;
    }
  } finally { reader.releaseLock(); }
}

export const biboChatManager = {
  account: async () => (await request<{ user: BiboUser }>("auth/me")).user,
  history: async () => (await request<{ messages: BiboMessage[] }>("history")).messages,
  sendCode: async (email: string) => request<{ maskedEmail?: string }>("auth/send-code", { email }),
  login: async (email: string, password: string) => (await request<{ user: BiboUser }>("auth/login", { email, password })).user,
  register: async (email: string, password: string, code: string) => (await request<{ user: BiboUser }>("auth/register", { email, password, code })).user,
  logout: async () => request("auth/logout", {}),
  reset: async () => request("reset", {}),
  cancel: async (runId: string) => request("cancel", { runId }),
  send: async (message: string, onEvent: (event: ChatEvent) => void) => {
    const response = await fetch("/api/chat", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      const value = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(value.error ?? `请求失败 (${response.status})`);
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      const value = await response.json() as { messages?: BiboMessage[]; text?: string };
      if (!value.messages || typeof value.text !== "string") throw new Error("回答没有保存，请重试。");
      onEvent({ name: "committed", value: { messages: value.messages, text: value.text } });
      return;
    }
    await readEvents(response, onEvent);
  },
};
