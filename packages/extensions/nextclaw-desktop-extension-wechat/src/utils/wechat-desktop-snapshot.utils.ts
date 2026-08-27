import { createHash } from "node:crypto";
import type {
  AccessibilityNode,
  WechatDesktopObservationConfig,
  WechatDesktopSnapshot,
  WechatVisibleMessage,
} from "../types/wechat-desktop-extension.types.js";

const DEFAULT_IGNORE_PREFIXES = ["🤖[墨爪]"];
const MESSAGE_ROLES = new Set(["AXStaticText", "AXTextArea", "AXTextField"]);

export function normalizeWechatObservationConfig(
  value: unknown,
): WechatDesktopObservationConfig {
  const record = asRecord(value);
  const maxItems = Number(record.maxItems);
  const ignorePrefixes = Array.isArray(record.ignorePrefixes)
    ? record.ignorePrefixes
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : DEFAULT_IGNORE_PREFIXES;
  return {
    ...(readString(record.conversation)
      ? { conversation: readString(record.conversation) }
      : {}),
    ignorePrefixes,
    maxItems: Number.isInteger(maxItems)
      ? Math.max(1, Math.min(100, maxItems))
      : 30,
  };
}

export function toWechatDesktopSnapshot(input: {
  root: unknown;
  config: WechatDesktopObservationConfig;
  capturedAt?: string;
}): WechatDesktopSnapshot {
  const messages: WechatVisibleMessage[] = [];
  visitNode(input.root, [], input.config, messages);
  return {
    applicationId: "wechat",
    ...(input.config.conversation
      ? { conversation: input.config.conversation }
      : {}),
    messages: messages.slice(-input.config.maxItems),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
  };
}

export function findNewWechatMessages(
  previous: WechatDesktopSnapshot,
  next: WechatDesktopSnapshot,
): WechatVisibleMessage[] {
  const seen = new Set(previous.messages.map((message) => message.id));
  return next.messages.filter((message) => !seen.has(message.id));
}

function visitNode(
  value: unknown,
  path: number[],
  config: WechatDesktopObservationConfig,
  messages: WechatVisibleMessage[],
): void {
  const node = asNode(value);
  if (!node) return;
  const text = readNodeText(node);
  if (
    text &&
    MESSAGE_ROLES.has(node.role ?? "") &&
    !config.ignorePrefixes.some((prefix) => text.startsWith(prefix))
  ) {
    messages.push({
      id: createHash("sha256")
        .update(`${path.join(".")}\u0000${text}`)
        .digest("hex")
        .slice(0, 24),
      text,
      path,
    });
  }
  for (const [index, child] of (node.children ?? []).entries()) {
    visitNode(child, [...path, index], config, messages);
  }
}

function readNodeText(node: AccessibilityNode): string | null {
  for (const value of [node.value, node.title, node.description]) {
    const text = readString(value);
    if (text && text.length <= 8_000) return text;
  }
  return null;
}

function asNode(value: unknown): AccessibilityNode | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AccessibilityNode)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
