import type { ThreadOptions } from "@openai/codex-sdk";
import type { CodexThreadInput } from "@/codex-input.utils.js";
import type { JsonObject } from "@/types/codex-app-server-runtime.types.js";

type AppServerUserInput =
  | { type: "text"; text: string }
  | { type: "localImage"; path: string };

export function toAppServerInput(input: CodexThreadInput): AppServerUserInput[] {
  if (typeof input === "string") {
    return input.trim() ? [{ type: "text", text: input }] : [];
  }
  const out: AppServerUserInput[] = [];
  for (const item of input) {
    if (item.type === "text") {
      out.push({ type: "text", text: item.text });
      continue;
    }
    if (item.type === "local_image") {
      out.push({ type: "localImage", path: item.path });
    }
  }
  return out;
}

export function splitModelRoute(value: string | undefined): {
  model?: string;
  modelProvider?: string;
} {
  const normalized = readString(value);
  if (!normalized) {
    return {};
  }
  const slashIndex = normalized.indexOf("/");
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return { model: normalized };
  }
  return {
    modelProvider: normalized.slice(0, slashIndex),
    model: normalized.slice(slashIndex + 1),
  };
}

export function compactObject(value: JsonObject): JsonObject {
  const out: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) {
      out[key] = child;
    }
  }
  return out;
}

const SANDBOX_POLICY_TYPE_BY_MODE: Record<NonNullable<ThreadOptions["sandboxMode"]>, string> = {
  "read-only": "readOnly",
  "workspace-write": "workspaceWrite",
  "danger-full-access": "dangerFullAccess",
};

export function toSandboxPolicy(
  value: ThreadOptions["sandboxMode"] | undefined,
): JsonObject | undefined {
  return value ? { type: SANDBOX_POLICY_TYPE_BY_MODE[value] } : undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
