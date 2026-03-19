import { ensureUiBridgeSecret } from "@nextclaw/server";

export type RelayRequestFrame = {
  type: "request";
  requestId: string;
  method: string;
  path: string;
  headers: Array<[string, string]>;
  bodyBase64?: string;
};

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function decodeBase64(base64: string | undefined): Uint8Array {
  if (!base64) {
    return new Uint8Array();
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export class RemoteRelayBridge {
  constructor(private readonly localOrigin: string) {}

  async ensureLocalUiHealthy(): Promise<void> {
    const response = await fetch(`${this.localOrigin}/api/health`);
    if (!response.ok) {
      throw new Error(`Local UI is not healthy at ${this.localOrigin}. Start NextClaw first.`);
    }
  }

  async forward(frame: RelayRequestFrame, socket: WebSocket): Promise<void> {
    const bridgeCookie = await this.requestBridgeCookie();
    const url = new URL(frame.path, this.localOrigin);
    const headers = this.createForwardHeaders(frame.headers, bridgeCookie);
    const response = await fetch(url, {
      method: frame.method,
      headers,
      body: frame.method === "GET" || frame.method === "HEAD" ? undefined : decodeBase64(frame.bodyBase64)
    });
    const responseHeaders = Array.from(response.headers.entries()).filter(([key]) => {
      const lower = key.toLowerCase();
      return !["content-length", "connection", "transfer-encoding", "set-cookie"].includes(lower);
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (response.body && contentType.startsWith("text/event-stream")) {
      await this.sendStreamingResponse({ frame, response, responseHeaders, socket });
      return;
    }
    const responseBody = response.body ? new Uint8Array(await response.arrayBuffer()) : new Uint8Array();
    socket.send(JSON.stringify({
      type: "response",
      requestId: frame.requestId,
      status: response.status,
      headers: responseHeaders,
      bodyBase64: encodeBase64(responseBody)
    }));
  }

  private createForwardHeaders(headersList: Array<[string, string]>, bridgeCookie: string | null): Headers {
    const headers = new Headers();
    for (const [key, value] of headersList) {
      const lower = key.toLowerCase();
      if ([
        "host",
        "connection",
        "content-length",
        "cookie",
        "x-forwarded-for",
        "x-forwarded-proto",
        "cf-connecting-ip"
      ].includes(lower)) {
        continue;
      }
      headers.set(key, value);
    }
    if (bridgeCookie) {
      headers.set("cookie", bridgeCookie);
    }
    return headers;
  }

  private async requestBridgeCookie(): Promise<string | null> {
    const response = await fetch(`${this.localOrigin}/api/auth/bridge`, {
      method: "POST",
      headers: {
        "x-nextclaw-ui-bridge-secret": ensureUiBridgeSecret()
      }
    });
    const payload = (await response.json()) as { ok?: boolean; data?: { cookie?: string | null }; error?: { message?: string } };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error?.message ?? `Failed to request local auth bridge (${response.status}).`);
    }
    return typeof payload.data?.cookie === "string" && payload.data.cookie.trim().length > 0
      ? payload.data.cookie.trim()
      : null;
  }

  private async sendStreamingResponse(params: {
    frame: RelayRequestFrame;
    response: Response;
    responseHeaders: Array<[string, string]>;
    socket: WebSocket;
  }): Promise<void> {
    params.socket.send(JSON.stringify({
      type: "response.start",
      requestId: params.frame.requestId,
      status: params.response.status,
      headers: params.responseHeaders
    }));
    const reader = params.response.body?.getReader();
    if (!reader) {
      params.socket.send(JSON.stringify({
        type: "response.end",
        requestId: params.frame.requestId
      }));
      return;
    }
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value && value.length > 0) {
          params.socket.send(JSON.stringify({
            type: "response.chunk",
            requestId: params.frame.requestId,
            bodyBase64: encodeBase64(value)
          }));
        }
      }
    } finally {
      reader.releaseLock();
    }
    params.socket.send(JSON.stringify({
      type: "response.end",
      requestId: params.frame.requestId
    }));
  }
}
