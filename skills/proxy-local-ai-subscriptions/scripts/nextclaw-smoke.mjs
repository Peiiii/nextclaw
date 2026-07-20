#!/usr/bin/env node

import {
  discoverNextclawApi,
  fail,
  normalizeNextclawApi,
  parseOptions,
  printJson,
  requireOption,
} from "./local-subscription-proxy.utils.mjs";

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim() || "message";
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: null };
  }
}

function eventType(entry) {
  return typeof entry?.data?.type === "string" ? entry.data.type : entry?.event;
}

function completedText(entry) {
  const parts = entry?.data?.payload?.message?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

async function readEvents(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
        buffer = buffer.slice(boundary + separator.length);
        const entry = parseSseBlock(block);
        if (entry && onEvent(entry) === true) return;
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function buildEnvelope({ model, prompt, sessionId }) {
  return {
    sessionId,
    correlationId: createId("corr"),
    metadata: {
      agentRuntimeId: "native",
      session_type: "native",
      sessionType: "native",
      preferred_model: model,
      model,
    },
    message: {
      id: createId("user"),
      sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text: prompt }],
    },
  };
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write("Usage: node scripts/nextclaw-smoke.mjs --model <provider/model> [--nextclaw-api <url>] [--nextclaw-command <path>] [--prompt <text>] [--expect <text>] [--timeout-ms <ms>]\n");
    return;
  }
  const options = parseOptions(process.argv.slice(2), {
    values: ["model", "nextclaw-api", "nextclaw-command", "prompt", "expect", "timeout-ms"],
  });
  const model = requireOption(options, "model");
  if (!model.startsWith("local-subscriptions/")) {
    throw new Error("--model must use the local-subscriptions/<raw-model-id> provider scope");
  }
  const nextclawApi = options["nextclaw-api"]
    ? normalizeNextclawApi(options["nextclaw-api"])
    : discoverNextclawApi(options["nextclaw-command"] || "nextclaw");
  const origin = nextclawApi.slice(0, -4);
  const expected = options.expect || "NEXTCLAW_NCP_PROXY_OK";
  const prompt = options.prompt || `Reply exactly ${expected}`;
  const timeoutMs = Number.parseInt(options["timeout-ms"] || "120000", 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) {
    throw new Error("--timeout-ms must be an integer of at least 1000");
  }

  const sessionTypesResponse = await fetch(`${origin}/api/ncp/session-types`);
  if (!sessionTypesResponse.ok) {
    throw new Error(`Session type discovery failed with HTTP ${sessionTypesResponse.status}`);
  }
  const sessionTypes = await sessionTypesResponse.json();
  const native = sessionTypes?.data?.options?.find((entry) => entry?.value === "native");
  if (native?.ready !== true) {
    throw new Error(`Native session type is not ready: ${native?.reasonMessage || native?.reason || "unknown reason"}`);
  }

  const sessionId = createId("smoke-native-local-subscriptions");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`NCP smoke timed out after ${timeoutMs}ms`)), timeoutMs);
  const events = [];
  let assistantText = "";
  let errorMessage = "";
  let terminalEvent = "";
  const startedAt = Date.now();
  try {
    const streamResponse = await fetch(
      `${origin}/api/ncp/agent/stream?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { accept: "text/event-stream" }, signal: controller.signal },
    );
    if (!streamResponse.ok || !streamResponse.body) {
      throw new Error(`NCP stream failed with HTTP ${streamResponse.status}`);
    }
    const readPromise = readEvents(streamResponse.body, (entry) => {
      const type = eventType(entry);
      events.push(type);
      if (type === "message.text-delta" && typeof entry?.data?.payload?.delta === "string") {
        assistantText += entry.data.payload.delta;
      }
      if (type === "message.completed") {
        assistantText = completedText(entry) || assistantText;
      }
      if (type === "run.error" || type === "message.failed" || entry.event === "error") {
        errorMessage = entry?.data?.payload?.error || entry?.data?.message || "NCP run failed";
        terminalEvent = type;
        return true;
      }
      if (type === "run.finished") {
        terminalEvent = type;
        return true;
      }
      return false;
    });

    const sendResponse = await fetch(`${origin}/api/ncp/agent/send`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope({ model, prompt, sessionId })),
      signal: controller.signal,
    });
    if (!sendResponse.ok) {
      throw new Error(`NCP send failed with HTTP ${sendResponse.status}: ${await sendResponse.text()}`);
    }
    await readPromise;
    assistantText = assistantText.trim();
    if (errorMessage) throw new Error(errorMessage);
    if (assistantText !== expected) {
      throw new Error(`NCP reply did not exactly match the expected marker; received: ${assistantText || "(empty)"}`);
    }
    printJson({
      ok: true,
      nextclawApi,
      sessionType: "native",
      model,
      sessionId,
      expected,
      assistantText,
      terminalEvent,
      eventTypes: events,
      latencyMs: Date.now() - startedAt,
    });
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

main().catch(fail);
