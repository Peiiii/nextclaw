import { createHash } from "node:crypto";
import { BUILTIN_MAIN_AGENT_ID } from "@nextclaw/core";

export const AGENT_RUN_PEER_ID_METADATA_KEY = "agent_peer_id";
export const AGENT_RUN_PEER_SCOPE_METADATA_KEY = "agent_peer_scope";

export type AgentPeerSessionIdentity = {
  metadata: Record<string, unknown>;
  sessionId: string;
};

export function createAgentPeerSessionIdentity(params: {
  agentId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  peerId: string;
}): AgentPeerSessionIdentity {
  const scope = resolveAgentPeerScope(params);
  return {
    metadata: {
      [AGENT_RUN_PEER_ID_METADATA_KEY]: params.peerId,
      [AGENT_RUN_PEER_SCOPE_METADATA_KEY]: scope,
    },
    sessionId: `agent-peer-${createHash("sha256")
      .update(`${scope}\0${params.peerId}`)
      .digest("hex")
      .slice(0, 32)}`,
  };
}

function resolveAgentPeerScope(params: {
  agentId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}): string {
  const metadata = params.metadata ?? {};
  const explicitScope =
    readOptionalString(metadata[AGENT_RUN_PEER_SCOPE_METADATA_KEY]) ??
    readOptionalString(metadata.agentPeerScope);
  if (explicitScope) {
    return explicitScope;
  }
  const agentId = readOptionalString(params.agentId) ?? BUILTIN_MAIN_AGENT_ID;
  const channel =
    readOptionalString(params.channel) ??
    readOptionalString(metadata.channel) ??
    "agent-run";
  const accountId =
    readOptionalString(metadata.accountId) ??
    readOptionalString(metadata.account_id) ??
    "default";
  return `agent:${agentId}:${channel}:${accountId}`;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}
