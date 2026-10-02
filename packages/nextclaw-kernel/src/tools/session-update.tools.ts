import { normalizeToolParams } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionSettingsPatch } from "@kernel/types/session.types.js";

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}
export class SessionsUpdateTool implements NcpTool {
  readonly name = "sessions_update";
  readonly description = "Rename, pin or unpin a session, and/or bind it to an existing project directory.";
  readonly parameters = {
    type: "object",
    properties: {
      pinned: {
        type: "boolean",
        description: "Persist the session pin: true to pin, false to unpin.",
      },
      sessionKey: {
        type: "string",
        description: "Exact session id to update.",
      },
      label: {
        type: "string",
        description: "New session name.",
      },
      projectRoot: {
        type: "string",
        description: "Existing project directory to bind to this session.",
      },
    },
    required: ["sessionKey"],
    additionalProperties: false,
  };

  constructor(private readonly sessions: SessionManager) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const sessionKey = readRequiredString(params.sessionKey, "sessionKey");
    const patch: SessionSettingsPatch = {};
    if (Object.prototype.hasOwnProperty.call(params, "label")) {
      patch.label = readRequiredString(params.label, "label");
    }
    if (Object.prototype.hasOwnProperty.call(params, "projectRoot")) {
      patch.projectRoot = readRequiredString(params.projectRoot, "projectRoot");
    }
    if (Object.prototype.hasOwnProperty.call(params, "pinned")) {
      if (typeof params.pinned !== "boolean") throw new Error("pinned must be a boolean.");
      patch.pinned = params.pinned;
    }
    if (patch.label === undefined && patch.projectRoot === undefined && patch.pinned === undefined) {
      throw new Error("label, projectRoot or pinned is required.");
    }
    const session = await this.sessions.patchSessionSettings(sessionKey, patch);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }
    return JSON.stringify(session, null, 2);
  };
}
