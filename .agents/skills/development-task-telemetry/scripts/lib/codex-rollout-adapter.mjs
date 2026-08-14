import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  extractAssistantText,
  parseFrameMarker,
  USAGE_KEYS,
} from "./task-phase-protocol.mjs";

export function emptyUsage() {
  return Object.fromEntries(USAGE_KEYS.map((key) => [key, 0]));
}

export function sumUsage(left, right) {
  return Object.fromEntries(
    USAGE_KEYS.map((key) => [key, left[key] + (right?.[key] ?? 0)]),
  );
}

function normalizeUsage(value) {
  if (!value || typeof value !== "object") return null;
  const normalized = {};
  for (const key of USAGE_KEYS) {
    const tokenCount = value[key];
    if (!Number.isFinite(tokenCount) || tokenCount < 0) return null;
    normalized[key] = tokenCount;
  }
  return normalized;
}

function subtractUsage(current, previous) {
  return Object.fromEntries(
    USAGE_KEYS.map((key) => [key, current[key] - previous[key]]),
  );
}

function hasCounterReset(current, previous) {
  return USAGE_KEYS.some((key) => current[key] < previous[key]);
}

function makeWarning(code, details = {}) {
  return { code, ...details };
}

export async function parseRollout(path, fileOrder) {
  const source = await readFile(path, "utf8");
  const records = [];
  const warnings = [];

  for (const [lineIndex, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      warnings.push(makeWarning("invalid_json", { path, line: lineIndex + 1 }));
    }
  }

  let threadId = basename(path, ".jsonl");
  let workspace = null;
  let model = "unknown";
  let effort = "unknown";
  let previousUsage = null;
  let sawSessionMetaBeforeFirstToken = false;
  let pendingAssistantTexts = [];
  let pendingHasToolCall = false;
  let pendingTimestamp = null;
  let frameIndex = 0;
  const frames = [];

  const closeFrame = (record, usage, frameWarnings) => {
    frames.push({
      path,
      fileOrder,
      frameIndex: frameIndex++,
      threadId,
      workspace,
      timestamp: record?.timestamp ?? pendingTimestamp,
      model,
      effort,
      usage,
      hasToolCall: pendingHasToolCall,
      marker: parseFrameMarker(pendingAssistantTexts),
      warnings: frameWarnings,
    });
    pendingAssistantTexts = [];
    pendingHasToolCall = false;
    pendingTimestamp = null;
  };

  for (const record of records) {
    if (record.type === "session_meta") {
      if (typeof record.payload?.id === "string") threadId = record.payload.id;
      if (typeof record.payload?.cwd === "string")
        workspace = record.payload.cwd;
      if (previousUsage === null) sawSessionMetaBeforeFirstToken = true;
    }

    if (record.type === "turn_context") {
      if (typeof record.payload?.cwd === "string")
        workspace = record.payload.cwd;
      if (typeof record.payload?.model === "string")
        model = record.payload.model;
      if (typeof record.payload?.effort === "string")
        effort = record.payload.effort;
    }

    const assistantText =
      record.type === "response_item"
        ? extractAssistantText(record.payload)
        : null;
    if (assistantText !== null) pendingAssistantTexts.push(assistantText);
    if (
      record.type === "response_item" &&
      (record.payload?.type === "custom_tool_call" ||
        record.payload?.type === "function_call")
    ) {
      pendingHasToolCall = true;
    }
    if (pendingTimestamp === null && record.timestamp)
      pendingTimestamp = record.timestamp;

    if (record.type !== "event_msg" || record.payload?.type !== "token_count")
      continue;

    const currentUsage = normalizeUsage(record.payload.info?.total_token_usage);
    const frameWarnings = [];
    let frameUsage = null;

    if (!currentUsage) {
      frameWarnings.push(
        makeWarning("usage_unavailable", { path, frame: frameIndex }),
      );
    } else if (previousUsage === null) {
      if (sawSessionMetaBeforeFirstToken) {
        frameUsage = currentUsage;
      } else {
        frameWarnings.push(
          makeWarning("usage_unavailable", { path, frame: frameIndex }),
        );
      }
    } else if (hasCounterReset(currentUsage, previousUsage)) {
      frameUsage = currentUsage;
      frameWarnings.push(
        makeWarning("counter_reset", { path, frame: frameIndex }),
      );
    } else {
      frameUsage = subtractUsage(currentUsage, previousUsage);
    }

    if (currentUsage) previousUsage = currentUsage;
    closeFrame(record, frameUsage, frameWarnings);
  }

  if (pendingAssistantTexts.length > 0 || pendingHasToolCall) {
    closeFrame({ timestamp: pendingTimestamp }, null, [
      makeWarning("usage_unavailable", { path, frame: frameIndex }),
    ]);
  }

  return { path, threadId, workspace, frames, warnings };
}
