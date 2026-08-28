import { createHash } from "node:crypto";

const MAX_TOOL_NAME_LENGTH = 64;
const HASH_LENGTH = 8;
const TOOL_PREFIX = "service__";

export function buildServiceActionToolName(actionId: string): string {
  const readable = actionId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "action";
  const hash = createHash("sha256").update(actionId).digest("hex").slice(0, HASH_LENGTH);
  const suffix = `__${hash}`;
  const available = MAX_TOOL_NAME_LENGTH - TOOL_PREFIX.length - suffix.length;
  return `${TOOL_PREFIX}${readable.slice(0, available)}${suffix}`;
}
