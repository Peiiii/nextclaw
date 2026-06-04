import type {
  NcpEndpointEvent,
  NcpMessageAbortPayload,
  NcpRunHandle,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import type { AgentRunSendIngressPayload } from "@nextclaw/shared";
import type { NextClawClientOptions } from "../types/nextclaw-request.types.js";
import { resolveApiUrl } from "../utils/url.utils.js";
import type { RequestService } from "./request.service.js";

export type NextClawAgentRunStreamHandler = (event: NcpEndpointEvent) => void;

export type NextClawAgentRunStreamOptions = {
  onError?: (error: unknown) => void;
  signal?: AbortSignal;
};

export type NextClawAgentRunStreamSubscription = {
  close: () => void;
};

type SseFrame = {
  data: string;
  event: string;
};

function parseSseFrame(rawFrame: string): SseFrame | null {
  const lines = rawFrame.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return {
    event,
    data: dataLines.join("\n"),
  };
}

function parseNcpEvent(data: string): NcpEndpointEvent | null {
  try {
    const parsed = JSON.parse(data) as NcpEndpointEvent;
    return parsed && typeof parsed === "object" && "type" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

export class AgentRunsService {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly transport;

  constructor(
    private readonly requestService: RequestService,
    options: NextClawClientOptions,
  ) {
    const { baseUrl, fetchImpl, headers, token, transport } = options;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl ?? fetch;
    this.transport = transport;
    this.defaultHeaders = {
      Accept: "application/json",
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  send = async (payload: AgentRunSendIngressPayload): Promise<NcpRunHandle> => {
    return await this.requestService.post<NcpRunHandle>("/api/agent-runs/send", payload);
  };

  abort = async (
    payload: NcpMessageAbortPayload,
  ): Promise<{ accepted: true }> => {
    return await this.requestService.post<{ accepted: true }>("/api/agent-runs/abort", payload);
  };

  stream = (
    payload: NcpStreamRequestPayload,
    handler: NextClawAgentRunStreamHandler,
    options: NextClawAgentRunStreamOptions = {},
  ): NextClawAgentRunStreamSubscription => {
    if (this.transport) {
      throw new Error("Agent run streaming requires the HTTP fetch transport.");
    }
    const controller = new AbortController();
    const abortOnSignal = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abortOnSignal, { once: true });
    void this.consumeStream(payload, handler, controller.signal, options.onError)
      .finally(() => {
        options.signal?.removeEventListener("abort", abortOnSignal);
      });
    return {
      close: () => {
        controller.abort();
        options.signal?.removeEventListener("abort", abortOnSignal);
      },
    };
  };

  private consumeStream = async (
    payload: NcpStreamRequestPayload,
    handler: NextClawAgentRunStreamHandler,
    signal: AbortSignal,
    onError: ((error: unknown) => void) | undefined,
  ): Promise<void> => {
    try {
      const url = new URL(resolveApiUrl(this.baseUrl, "/api/agent-runs/stream"));
      url.searchParams.set("sessionId", payload.sessionId);
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          ...this.defaultHeaders,
          Accept: "text/event-stream",
        },
        signal,
      });
      if (!response.ok) {
        throw new Error(`Agent run stream failed with HTTP ${response.status}.`);
      }
      if (!response.body) {
        throw new Error("Agent run stream response has no body.");
      }
      await this.readEventStream(response.body, handler, signal);
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      onError?.(error);
    }
  };

  private readEventStream = async (
    body: ReadableStream<Uint8Array>,
    handler: NextClawAgentRunStreamHandler,
    signal: AbortSignal,
  ): Promise<void> => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = this.drainFrames(buffer, handler);
      }
      buffer += decoder.decode();
      this.drainFrames(`${buffer}\n\n`, handler);
    } finally {
      reader.releaseLock();
    }
  };

  private drainFrames = (
    buffer: string,
    handler: NextClawAgentRunStreamHandler,
  ): string => {
    const normalized = buffer.replaceAll("\r\n", "\n");
    const frames = normalized.split("\n\n");
    const rest = frames.pop() ?? "";
    for (const rawFrame of frames) {
      const frame = parseSseFrame(rawFrame);
      if (frame?.event !== "ncp-event") {
        continue;
      }
      const event = parseNcpEvent(frame.data);
      if (event) {
        handler(event);
      }
    }
    return rest;
  };
}
