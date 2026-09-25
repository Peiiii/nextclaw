import type { BiboChatEvent, BiboClientOptions, BiboMessage, BiboUser } from "../types/bibo-client.types";
import { BiboClientError, isRecord, readBiboStream, readCommitted, readMessages, readUser } from "../utils/bibo-protocol.utils";

function errorMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.error === "string" ? value.error : null;
}

export class BiboClient {
  private readonly fetcher: typeof fetch;

  constructor(options: BiboClientOptions = {}) {
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private fetchResponse = async (path: string, init: RequestInit): Promise<Response> => {
    try { return await this.fetcher(path, init); }
    catch { throw new BiboClientError("网络连接失败，请稍后重试。"); }
  };

  private request = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await this.fetchResponse(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      ...(body === undefined ? {} : {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new BiboClientError(errorMessage(value) ?? `请求失败 (${response.status})`, response.status);
    if (value === null) throw new BiboClientError("服务返回了无效的数据。");
    return value;
  };

  account = async (): Promise<BiboUser> => {
    const value = await this.request("auth/me");
    return readUser(isRecord(value) ? value.user : null);
  };

  history = async (): Promise<BiboMessage[]> => {
    const value = await this.request("history");
    return readMessages(isRecord(value) ? value.messages : null);
  };

  sendCode = async (email: string): Promise<{ maskedEmail?: string }> => {
    const value = await this.request("auth/send-code", { email });
    if (!isRecord(value)) throw new BiboClientError("验证码服务返回了无效的数据。");
    return typeof value.maskedEmail === "string" ? { maskedEmail: value.maskedEmail } : {};
  };

  login = async (email: string, password: string): Promise<BiboUser> => {
    const value = await this.request("auth/login", { email, password });
    return readUser(isRecord(value) ? value.user : null);
  };

  register = async (email: string, password: string, code: string): Promise<BiboUser> => {
    const value = await this.request("auth/register", { email, password, code });
    return readUser(isRecord(value) ? value.user : null);
  };

  logout = async (): Promise<void> => {
    const value = await this.request("auth/logout", {});
    if (!isRecord(value) || value.ok !== true) throw new BiboClientError("退出登录未得到确认。");
  };

  reset = async (): Promise<void> => {
    const value = await this.request("reset", {});
    if (!isRecord(value) || value.ok !== true) throw new BiboClientError("清空个人空间未得到确认。");
  };

  cancel = async (runId: string): Promise<void> => {
    const value = await this.request("cancel", { runId });
    if (!isRecord(value) || value.ok !== true) throw new BiboClientError("停止生成未得到确认。");
  };

  chat = async (message: string, onEvent: (event: BiboChatEvent) => void): Promise<void> => {
    const response = await this.fetchResponse("/api/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      const value: unknown = await response.json().catch(() => null);
      throw new BiboClientError(errorMessage(value) ?? `请求失败 (${response.status})`, response.status);
    }
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      await readBiboStream(response, onEvent);
      return;
    }
    const value: unknown = await response.json().catch(() => null);
    onEvent(readCommitted(value));
  };
}
