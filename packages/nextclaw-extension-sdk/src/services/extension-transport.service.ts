import type {
  ExtensionRequestResponse,
  ExtensionTransportEnvelope,
  NextClawExtensionOptions,
  NextClawExtensionWebSocketFactoryOptions,
  NextClawExtensionWebSocketLike,
} from "../types/extension-sdk.types.js";
import { getKeyId, ingressKeys } from "@nextclaw/shared";
import { normalizeEndpoint, resolveWebSocketUrl } from "../utils/extension-url.utils.js";
import WebSocket from "ws";

type EventStreamHandler = (event: ExtensionTransportEnvelope) => void;

type RuntimeEnv = {
  NEXTCLAW_EXTENSION_ENDPOINT?: string;
  NEXTCLAW_EXTENSION_GENERATION?: string;
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
  readonly generation: string;
  readonly token: string;
  readonly extensionId: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly webSocketFactory?: (
    url: string,
    options?: NextClawExtensionWebSocketFactoryOptions,
  ) => NextClawExtensionWebSocketLike;

  constructor(options: NextClawExtensionOptions = {}) {
    const env = readRuntimeEnv();
    this.endpoint = normalizeEndpoint(
      options.endpoint ?? requireRuntimeValue(env.NEXTCLAW_EXTENSION_ENDPOINT, "NEXTCLAW_EXTENSION_ENDPOINT"),
    );
    this.token = options.token ?? requireRuntimeValue(env.NEXTCLAW_EXTENSION_TOKEN, "NEXTCLAW_EXTENSION_TOKEN");
    this.extensionId =
      options.extensionId ?? requireRuntimeValue(env.NEXTCLAW_EXTENSION_ID, "NEXTCLAW_EXTENSION_ID");
    this.generation =
      options.generation ?? requireRuntimeValue(env.NEXTCLAW_EXTENSION_GENERATION, "NEXTCLAW_EXTENSION_GENERATION");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.webSocketFactory = options.webSocketFactory;
    if (typeof this.fetchImpl !== "function") {
      throw new Error("fetch is unavailable. Provide fetch when creating the extension.");
    }
  }

  readonly postIngress = async <TResponse = unknown>(
    type: string,
    payload: unknown,
  ): Promise<TResponse> => {
    const envelope: ExtensionTransportEnvelope = {
      type,
      extensionId: this.extensionId,
      generation: this.generation,
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
      throw new Error(this.readErrorMessage(body, `NextClaw ingress failed with ${response.status}`));
    }
    return this.readResponseData<TResponse>(body);
  };

  readonly respondToRequest = async (response: ExtensionRequestResponse): Promise<void> => {
    await this.postIngress(getKeyId(ingressKeys.extension.response), response);
  };

  readonly reportReady = async (pid: number): Promise<void> => {
    await this.postIngress(getKeyId(ingressKeys.extension.runtimeReady), {
      generation: this.generation,
      pid,
    });
  };

  readonly subscribe = (handler: EventStreamHandler): { close: () => void; ready: Promise<void> } => {
    const socket = this.createSocket(resolveWebSocketUrl(this.endpoint, "/ws"), {
      headers: {
        authorization: `Bearer ${this.token}`,
        "x-nextclaw-extension-id": this.extensionId,
        "x-nextclaw-extension-generation": this.generation,
      },
    });
    let opened = false;
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    void ready.catch(() => undefined);
    socket.onopen = () => {
      opened = true;
      resolveReady();
    };
    socket.onerror = () => {
      if (!opened) {
        rejectReady(new Error(`Extension ${this.extensionId} event stream failed before opening.`));
      }
    };
    socket.onclose = () => {
      if (!opened) {
        rejectReady(new Error(`Extension ${this.extensionId} event stream closed before opening.`));
      }
    };
    socket.onmessage = (event) => {
      const envelope = this.parseEnvelope(event.data);
      if (envelope) {
        handler(envelope);
      }
    };
    return {
      close: () => socket.close(),
      ready,
    };
  };

  private readonly createSocket = (
    url: string,
    options: NextClawExtensionWebSocketFactoryOptions,
  ): NextClawExtensionWebSocketLike => {
    if (this.webSocketFactory) {
      return this.webSocketFactory(url, options);
    }
    const socket = new WebSocket(url, { headers: options.headers });
    socket.on("error", () => undefined);
    return socket as unknown as NextClawExtensionWebSocketLike;
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

  private readonly readResponseData = <TResponse>(body: unknown): TResponse => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const record = body as { ok?: unknown; data?: unknown };
      if (record.ok === true && "data" in record) {
        return record.data as TResponse;
      }
    }
    return body as TResponse;
  };
}
