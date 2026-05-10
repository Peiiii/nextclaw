import type {
  ExtensionTransportEnvelope,
  NextClawExtensionOptions,
  NextClawExtensionWebSocketLike,
} from "../types/extension-sdk.types.js";
import { normalizeEndpoint, resolveWebSocketUrl } from "../utils/extension-url.utils.js";

type RealtimeHandler = (event: ExtensionTransportEnvelope) => void;

type RuntimeEnv = {
  NEXTCLAW_EXTENSION_ENDPOINT?: string;
  NEXTCLAW_EXTENSION_TOKEN?: string;
  NEXTCLAW_EXTENSION_ID?: string;
};

declare const process: { env: RuntimeEnv } | undefined;

function readRuntimeEnv(): RuntimeEnv {
  return typeof process === "undefined" ? {} : process.env;
}

function requireRuntimeValue(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required.`);
  }
  return trimmed;
}

export class ExtensionTransportService {
  readonly token: string;
  readonly extensionId: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly webSocketFactory?: (url: string) => NextClawExtensionWebSocketLike;

  constructor(options: NextClawExtensionOptions = {}) {
    const env = readRuntimeEnv();
    this.endpoint = normalizeEndpoint(
      options.endpoint ?? requireRuntimeValue(env.NEXTCLAW_EXTENSION_ENDPOINT, "NEXTCLAW_EXTENSION_ENDPOINT"),
    );
    this.token = options.token ?? requireRuntimeValue(env.NEXTCLAW_EXTENSION_TOKEN, "NEXTCLAW_EXTENSION_TOKEN");
    this.extensionId =
      options.extensionId ?? requireRuntimeValue(env.NEXTCLAW_EXTENSION_ID, "NEXTCLAW_EXTENSION_ID");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.webSocketFactory = options.webSocketFactory;
    if (typeof this.fetchImpl !== "function") {
      throw new Error("fetch is unavailable. Provide fetch when creating the extension.");
    }
  }

  readonly postWebhook = async <TResponse = unknown>(
    type: string,
    payload: unknown,
  ): Promise<TResponse> => {
    const envelope: ExtensionTransportEnvelope = {
      type,
      extensionId: this.extensionId,
      payload,
      emittedAt: new Date().toISOString(),
      source: "extension-sdk",
    };
    const response = await this.fetchImpl(`${this.endpoint}/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(envelope),
    });
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new Error(this.readErrorMessage(body, `NextClaw webhook failed with ${response.status}`));
    }
    return body as TResponse;
  };

  readonly subscribe = (handler: RealtimeHandler): { close: () => void } => {
    const socket = this.createSocket(resolveWebSocketUrl(this.endpoint, "/ws"));
    socket.onmessage = (event) => {
      const envelope = this.parseEnvelope(event.data);
      if (envelope) {
        handler(envelope);
      }
    };
    return {
      close: () => socket.close(),
    };
  };

  private readonly createSocket = (url: string): NextClawExtensionWebSocketLike => {
    if (this.webSocketFactory) {
      return this.webSocketFactory(url);
    }
    if (typeof globalThis.WebSocket !== "function") {
      throw new Error("WebSocket is unavailable. Provide webSocketFactory when creating the extension.");
    }
    return new globalThis.WebSocket(url) as unknown as NextClawExtensionWebSocketLike;
  };

  private readonly parseEnvelope = (value: unknown): ExtensionTransportEnvelope | null => {
    if (typeof value !== "string") {
      return null;
    }
    try {
      const parsed = JSON.parse(value) as ExtensionTransportEnvelope;
      return parsed && typeof parsed === "object" && typeof parsed.type === "string" ? parsed : null;
    } catch {
      return null;
    }
  };

  private readonly readErrorMessage = (body: unknown, fallback: string): string => {
    if (!body || typeof body !== "object") {
      return fallback;
    }
    const error = (body as { error?: { message?: unknown } }).error;
    return typeof error?.message === "string" && error.message.trim() ? error.message : fallback;
  };
}
