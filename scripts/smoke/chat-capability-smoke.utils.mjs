export function parseSseBlock(block) {
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
    return null;
  }
  const raw = dataLines.join("\n");
  try {
    return {
      event: eventName,
      raw,
      data: JSON.parse(raw),
    };
  } catch {
    return {
      event: eventName,
      raw,
      data: null,
    };
  }
}

function extractTextParts(message) {
  if (!message || typeof message !== "object" || !Array.isArray(message.parts)) {
    return [];
  }
  return message.parts
    .filter((part) => part && typeof part === "object" && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text);
}

function createSummaryState() {
  return {
    eventTypes: [],
    assistantDeltaText: "",
    assistantCompletedText: "",
    reasoningText: "",
    errorMessage: "",
    terminalEvent: "",
  };
}

function applyTransportError(summary, entry) {
  const message = entry?.data?.message;
  summary.errorMessage = typeof message === "string" ? message : entry.raw;
  summary.terminalEvent = "error";
  summary.eventTypes.push("error");
}

function applyNcpEvent(summary, entry) {
  const payload = entry?.data?.payload;
  const type = typeof entry?.data?.type === "string" ? entry.data.type : entry.event;
  summary.eventTypes.push(type);

  if (type === "message.text-delta" && typeof payload?.delta === "string") {
    summary.assistantDeltaText += payload.delta;
    return;
  }
  if (type === "message.reasoning-delta" && typeof payload?.delta === "string") {
    summary.reasoningText += payload.delta;
    return;
  }
  if (type === "message.completed") {
    summary.assistantCompletedText = extractTextParts(payload?.message).join("");
    summary.terminalEvent = type;
    return;
  }
  if (type === "run.finished") {
    summary.terminalEvent = type;
    return;
  }
  if ((type === "run.error" || type === "message.failed") && typeof payload?.error === "string") {
    summary.errorMessage = payload.error;
    summary.terminalEvent = type;
  }
}

export function summarizeEvents(events) {
  const summary = createSummaryState();
  for (const entry of events) {
    if (entry.event === "error") {
      applyTransportError(summary, entry);
      continue;
    }
    applyNcpEvent(summary, entry);
  }

  const assistantText = (summary.assistantCompletedText || summary.assistantDeltaText).trim();
  const reasoningText = summary.reasoningText.trim();
  return {
    ok: !summary.errorMessage && assistantText.length > 0,
    eventTypes: summary.eventTypes,
    assistantText,
    reasoningText,
    errorMessage: summary.errorMessage,
    terminalEvent: summary.terminalEvent,
  };
}

export function printPretty(summary) {
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

export function isAbortError(error) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.toLowerCase().includes("abort"))
  );
}

export function isTerminalEvent(entry) {
  if (entry.event === "error") {
    return true;
  }
  const type = typeof entry?.data?.type === "string" ? entry.data.type : entry.event;
  return type === "run.finished" || type === "run.error" || type === "message.failed";
}

export function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
    };
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(signal.reason ?? new Error("aborted"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}
