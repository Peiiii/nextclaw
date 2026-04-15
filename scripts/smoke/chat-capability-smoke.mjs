#!/usr/bin/env node

import {
  createDeferred,
  delay,
  isAbortError,
  isTerminalEvent,
  parseSseBlock,
  printPretty,
  summarizeEvents,
} from "./chat-capability-smoke.utils.mjs";

const DEFAULT_PORT = 18792;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PROMPT = "Reply exactly OK";
const DEFAULT_SESSION_TYPE = "native";
const DEFAULT_TIMEOUT_MS = 120_000;
const SESSION_TYPE_READY_POLL_MS = 500;

function printHelp() {
  console.log(`Usage: pnpm smoke:ncp-chat -- [options]

Options:
  --session-type <type>   NCP session type to verify, e.g. native / codex
  --model <id>            Preferred model id, e.g. dashscope/qwen3-coder-next
  --port <port>           API port when base URL is omitted (default: ${DEFAULT_PORT})
  --base-url <url>        Full API base URL, e.g. http://127.0.0.1:18792
  --prompt <text>         User prompt to send (default: "${DEFAULT_PROMPT}")
  --timeout-ms <ms>       Abort timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --session-id <id>       Reuse a fixed session id instead of generating one
  --thinking <level>      Preferred thinking level metadata
  --json                  Print machine-readable JSON only
  --help                  Show this help
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    sessionType: DEFAULT_SESSION_TYPE,
    model: "",
    port: String(DEFAULT_PORT),
    baseUrl: "",
    prompt: DEFAULT_PROMPT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    sessionId: "",
    thinking: "",
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    }
    switch (arg) {
      case "--session-type":
        options.sessionType = next ?? "";
        index += 1;
        break;
      case "--model":
        options.model = next ?? "";
        index += 1;
        break;
      case "--port":
        options.port = next ?? "";
        index += 1;
        break;
      case "--base-url":
        options.baseUrl = next ?? "";
        index += 1;
        break;
      case "--prompt":
        options.prompt = next ?? "";
        index += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number.parseInt(next ?? "", 10);
        index += 1;
        break;
      case "--session-id":
        options.sessionId = next ?? "";
        index += 1;
        break;
      case "--thinking":
        options.thinking = next ?? "";
        index += 1;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!options.sessionType.trim()) {
    fail("--session-type is required");
  }
  if (!options.prompt.trim()) {
    fail("--prompt is required");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1_000) {
    fail("--timeout-ms must be a number >= 1000");
  }
  if (!options.baseUrl.trim()) {
    const port = Number.parseInt(options.port, 10);
    if (!Number.isFinite(port) || port <= 0) {
      fail("--port must be a positive integer");
    }
    options.baseUrl = `http://${DEFAULT_HOST}:${port}`;
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  return options;
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEnvelope(options) {
  const sessionId = options.sessionId.trim() || createId(`smoke-${options.sessionType.trim()}`);
  const metadata = {
    session_type: options.sessionType.trim(),
    sessionType: options.sessionType.trim(),
  };

  if (options.model.trim()) {
    metadata.preferred_model = options.model.trim();
    metadata.model = options.model.trim();
  }
  if (options.thinking.trim()) {
    metadata.preferred_thinking = options.thinking.trim();
    metadata.thinking = options.thinking.trim();
  }

  return {
    sessionId,
    correlationId: createId("corr"),
    metadata,
    message: {
      id: createId("user"),
      sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text: options.prompt.trim() }],
    },
  };
}

class NcpChatSmokeRunner {
  constructor(options) {
    this.options = options;
  }

  run = async () => {
    const envelope = buildEnvelope(this.options);
    const streamController = new AbortController();
    const sendController = new AbortController();
    const startedAt = Date.now();
    const events = [];
    let stream = null;
    const timer = setTimeout(() => {
      streamController.abort(new Error(`smoke timed out after ${this.options.timeoutMs}ms`));
      sendController.abort(new Error(`smoke timed out after ${this.options.timeoutMs}ms`));
    }, this.options.timeoutMs);

    try {
      await this.waitForSessionTypeReady(sendController.signal);
      stream = this.startStream({
        sessionId: envelope.sessionId,
        signal: streamController.signal,
        onEvent: (event) => {
          events.push(event);
          if (isTerminalEvent(event)) {
            streamController.abort();
          }
        },
      });
      await stream.ready;
      const response = await this.sendEnvelope(envelope, sendController.signal);
      await stream.done;
      const result = summarizeEvents(events);
      return {
        ...result,
        status: response.status,
        durationMs: Date.now() - startedAt,
        baseUrl: this.options.baseUrl,
        sessionId: envelope.sessionId,
        sessionType: this.options.sessionType,
        model: this.options.model.trim(),
      };
    } finally {
      clearTimeout(timer);
      if (!streamController.signal.aborted) {
        streamController.abort();
      }
      if (!sendController.signal.aborted) {
        sendController.abort();
      }
      await stream?.done.catch(() => undefined);
    }
  };

  waitForSessionTypeReady = async (signal) => {
    while (!signal.aborted) {
      const response = await fetch(`${this.options.baseUrl}/api/ncp/session-types`, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        signal,
      });
      if (!response.ok) {
        throw new Error(`session-types failed with HTTP ${response.status}: ${await response.text()}`);
      }
      const payload = await response.json();
      const options = Array.isArray(payload?.data?.options) ? payload.data.options : [];
      const sessionType = this.options.sessionType.trim();
      const option = options.find((entry) => entry?.value === sessionType);
      if (option?.ready === true) {
        return;
      }
      if (option && option.ready === false) {
        const reason = option.reasonMessage || option.reason || "unknown reason";
        throw new Error(`session type ${sessionType} is not ready: ${reason}`);
      }
      await delay(SESSION_TYPE_READY_POLL_MS, signal);
    }
  };

  sendEnvelope = async (envelope, signal) => {
    const response = await fetch(`${this.options.baseUrl}/api/ncp/agent/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(envelope),
      signal,
    });
    if (!response.ok) {
      throw new Error(`send failed with HTTP ${response.status}: ${await response.text()}`);
    }
    return response;
  };

  startStream = ({ sessionId, signal, onEvent }) => {
    const ready = createDeferred();
    const done = (async () => {
      try {
        const response = await fetch(
          `${this.options.baseUrl}/api/ncp/agent/stream?sessionId=${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            headers: {
              accept: "text/event-stream",
            },
            signal,
          },
        );
        if (!response.ok) {
          throw new Error(`stream failed with HTTP ${response.status}: ${await response.text()}`);
        }
        if (!response.body) {
          throw new Error("stream response has no body");
        }
        ready.resolve();
        await this.readStream(response.body, signal, onEvent);
      } catch (error) {
        if (signal.aborted && isAbortError(error)) {
          ready.resolve();
          return;
        }
        ready.reject(error);
        throw error;
      }
    })();
    return { ready: ready.promise, done };
  };

  readStream = async (body, signal, onEvent) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = this.consumeSseBuffer(buffer, onEvent);
      }
      buffer += decoder.decode();
      this.consumeSseBuffer(`${buffer}\n\n`, onEvent);
    } finally {
      reader.releaseLock();
    }
  };

  consumeSseBuffer = (buffer, onEvent) => {
    let nextBuffer = buffer;
    let boundary = nextBuffer.search(/\r?\n\r?\n/);
    while (boundary >= 0) {
      const block = nextBuffer.slice(0, boundary);
      const separator = nextBuffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
      nextBuffer = nextBuffer.slice(boundary + separator.length);
      const event = parseSseBlock(block);
      if (event) {
        onEvent(event);
      }
      boundary = nextBuffer.search(/\r?\n\r?\n/);
    }
    return nextBuffer;
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runner = new NcpChatSmokeRunner(options);
  const summary = await runner.run();

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printPretty(summary);
  }

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke failed: ${message}`);
  process.exit(1);
});
