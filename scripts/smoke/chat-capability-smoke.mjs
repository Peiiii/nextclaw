#!/usr/bin/env node

const DEFAULT_PORT = 18792;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PROMPT = "Reply exactly OK";
const DEFAULT_SESSION_TYPE = "native";
const DEFAULT_TIMEOUT_MS = 120_000;

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

function parseSseBody(body) {
  const blocks = body.split(/\r?\n\r?\n/g);
  const events = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/g).map((line) => line.trimEnd());
    const dataLines = [];
    let eventName = "message";
    for (const line of lines) {
      if (!line || line.startsWith(":")) {
        continue;
      }
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim() || "message";
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) {
      continue;
    }
    const raw = dataLines.join("\n");
    try {
      events.push({
        event: eventName,
        raw,
        data: JSON.parse(raw),
      });
    } catch {
      events.push({
        event: eventName,
        raw,
        data: null,
      });
    }
  }

  return events;
}

function extractTextParts(message) {
  if (!message || typeof message !== "object" || !Array.isArray(message.parts)) {
    return [];
  }
  return message.parts
    .filter((part) => part && typeof part === "object" && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text);
}

function summarizeEvents(events) {
  const eventTypes = [];
  let assistantText = "";
  let reasoningText = "";
  let errorMessage = "";
  let terminalEvent = "";

  for (const entry of events) {
    const payload = entry?.data?.payload;
    const type = typeof entry?.data?.type === "string" ? entry.data.type : entry.event;
    eventTypes.push(type);

    if (type === "message.text-delta" && typeof payload?.delta === "string") {
      assistantText += payload.delta;
      continue;
    }
    if (type === "message.reasoning-delta" && typeof payload?.delta === "string") {
      reasoningText += payload.delta;
      continue;
    }
    if (type === "message.completed") {
      assistantText += extractTextParts(payload?.message).join("");
      terminalEvent = type;
      continue;
    }
    if (type === "run.finished") {
      terminalEvent = type;
      continue;
    }
    if ((type === "run.error" || type === "message.failed") && typeof payload?.error === "string") {
      errorMessage = payload.error;
      terminalEvent = type;
      continue;
    }
  }

  const normalizedAssistantText = assistantText.trim();
  const normalizedReasoningText = reasoningText.trim();

  return {
    ok: !errorMessage && normalizedAssistantText.length > 0,
    eventTypes,
    assistantText: normalizedAssistantText,
    reasoningText: normalizedReasoningText,
    errorMessage,
    terminalEvent,
  };
}

function printPretty(summary) {
  const lines = [
    `Result: ${summary.ok ? "PASS" : "FAIL"}`,
    `Session Type: ${summary.sessionType}`,
    `Model: ${summary.model || "(default)"}`,
    `Base URL: ${summary.baseUrl}`,
    `Session ID: ${summary.sessionId}`,
    `HTTP Status: ${summary.status}`,
    `Terminal Event: ${summary.terminalEvent || "(none)"}`,
    `Assistant Text: ${summary.assistantText || "(empty)"}`,
  ];

  if (summary.reasoningText) {
    lines.push(`Reasoning Text: ${summary.reasoningText}`);
  }
  if (summary.errorMessage) {
    lines.push(`Error: ${summary.errorMessage}`);
  }
  lines.push(`Event Types: ${summary.eventTypes.join(", ") || "(none)"}`);
  console.log(lines.join("\n"));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envelope = buildEnvelope(options);
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => {
    controller.abort(new Error(`smoke timed out after ${options.timeoutMs}ms`));
  }, options.timeoutMs);

  try {
    const response = await fetch(`${options.baseUrl}/api/ncp/agent/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });
    const body = await response.text();
    const events = parseSseBody(body);
    const result = summarizeEvents(events);
    const summary = {
      ...result,
      status: response.status,
      durationMs: Date.now() - startedAt,
      baseUrl: options.baseUrl,
      sessionId: envelope.sessionId,
      sessionType: options.sessionType,
      model: options.model.trim(),
    };

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      printPretty(summary);
    }

    if (!response.ok || !summary.ok) {
      process.exitCode = 1;
    }
  } finally {
    clearTimeout(timer);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke failed: ${message}`);
  process.exit(1);
});
