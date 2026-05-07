import type { InboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";

const DEFAULT_AGENT_ID = "main";
const DEFAULT_ACCOUNT_ID = "default";

export type RoutePeerKind = "direct" | "group" | "channel";

export type RoutePeer = {
  kind: RoutePeerKind;
  id: string;
};

export type ParsedAgentSessionKey = {
  agentId: string;
  channel?: string;
  accountId?: string;
  peer?: RoutePeer;
};

export type ResolvedAgentRoute = {
  agentId: string;
  accountId: string;
  sessionKey: string;
  peer: RoutePeer;
  matchedBy: "binding" | "forced" | "default";
};

export type ParsedSimpleSessionKey = {
  channel: string;
  chatId: string;
};

export type ResolvedSessionDeliveryRoute = {
  channel: string;
  chatId: string;
  accountId?: string;
};

const PEER_KINDS: RoutePeerKind[] = ["direct", "group", "channel"];

function isPeerKind(value: string): value is RoutePeerKind {
  return PEER_KINDS.includes(value as RoutePeerKind);
}

function normalizeToken(value: unknown, fallback: string): string {
  if (typeof value === "number" || typeof value === "bigint") {
    const text = String(value).trim().toLowerCase();
    return text || fallback;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const text = value.trim().toLowerCase();
  return text || fallback;
}

export function normalizeOptionalRouteString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeAccountId(value: unknown): string {
  return normalizeToken(value, DEFAULT_ACCOUNT_ID);
}

function normalizeAgentId(value: unknown): string {
  return normalizeToken(value, DEFAULT_AGENT_ID);
}

function resolveDefaultAgentId(config: Config): string {
  const configured = Array.isArray(config.agents.list) ? config.agents.list : [];
  const normalized = configured
    .map((entry) => ({ ...entry, id: normalizeAgentId(entry.id) }))
    .filter((entry) => Boolean(entry.id));
  const explicitDefault = normalized.find((entry) => entry.default);
  if (explicitDefault) {
    return explicitDefault.id;
  }
  if (normalized.length > 0) {
    return normalized[0].id;
  }
  return DEFAULT_AGENT_ID;
}

function resolveKnownAgentId(config: Config, candidate: string | undefined, fallback: string): string {
  const normalizedCandidate = typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
  const candidateId = normalizedCandidate || fallback;
  const configured = Array.isArray(config.agents.list) ? config.agents.list : [];
  if (configured.length === 0) {
    return candidateId;
  }
  const known = configured.some((entry) => normalizeAgentId(entry.id) === candidateId);
  return known ? candidateId : fallback;
}

function resolveInboundAccountId(metadata: Record<string, unknown>): string {
  return normalizeAccountId(metadata.account_id ?? metadata.accountId);
}

function resolveFallbackPeerKind(params: { channel: string; metadata: Record<string, unknown> }): RoutePeerKind {
  const explicitIsGroup = params.metadata.is_group === true;
  if (explicitIsGroup) {
    if (params.channel === "discord") {
      return "channel";
    }
    return "group";
  }
  return "direct";
}

function resolveInboundPeer(msg: InboundMessage): RoutePeer {
  const metadata = msg.metadata ?? {};
  const explicitKind = normalizeToken(metadata.peer_kind ?? metadata.peerKind, "");
  const kind = isPeerKind(explicitKind)
    ? explicitKind
    : resolveFallbackPeerKind({
        channel: normalizeToken(msg.channel, "unknown"),
        metadata
      });
  const fallbackPeerId = kind === "direct" ? msg.senderId : msg.chatId;
  const peerId = normalizeToken(metadata.peer_id ?? metadata.peerId, normalizeToken(fallbackPeerId, "unknown"));
  return {
    kind,
    id: peerId
  };
}

function matchesChannel(bindingChannel: unknown, actual: string): boolean {
  const channel = normalizeToken(bindingChannel, "");
  return Boolean(channel) && channel === actual;
}

function matchesAccountId(bindingAccountId: unknown, actual: string): boolean {
  const raw = typeof bindingAccountId === "string" ? bindingAccountId.trim() : "";
  if (!raw) {
    return actual === DEFAULT_ACCOUNT_ID;
  }
  if (raw === "*") {
    return true;
  }
  return normalizeAccountId(raw) === actual;
}

function matchesPeer(bindingPeer: Config["bindings"][number]["match"]["peer"] | undefined, actual: RoutePeer): boolean {
  if (!bindingPeer) {
    return true;
  }
  const kind = normalizeToken(bindingPeer.kind, "");
  const id = normalizeToken(bindingPeer.id, "");
  if (!isPeerKind(kind) || !id) {
    return false;
  }
  return kind === actual.kind && id === actual.id;
}

function buildSessionKey(params: {
  config: Config;
  agentId: string;
  accountId: string;
  channel: string;
  peer: RoutePeer;
}): string {
  const agentId = normalizeAgentId(params.agentId);
  const channel = normalizeToken(params.channel, "unknown");
  const peerId = normalizeToken(params.peer.id, "unknown");
  const dmScope = params.config.session.dmScope;

  if (params.peer.kind === "direct") {
    if (dmScope === "main") {
      return `agent:${agentId}:main`;
    }
    if (dmScope === "per-peer") {
      return `agent:${agentId}:direct:${peerId}`;
    }
    if (dmScope === "per-channel-peer") {
      return `agent:${agentId}:${channel}:direct:${peerId}`;
    }
    return `agent:${agentId}:${channel}:${params.accountId}:direct:${peerId}`;
  }

  return `agent:${agentId}:${channel}:${params.peer.kind}:${peerId}`;
}

export function parseAgentScopedSessionKey(sessionKey?: string | null): ParsedAgentSessionKey | null {
  const value = (sessionKey ?? "").trim().toLowerCase();
  if (!value || !value.startsWith("agent:")) {
    return null;
  }
  const parts = value.split(":");
  if (parts.length < 3) {
    return null;
  }

  const agentId = normalizeAgentId(parts[1]);
  const third = parts[2];
  if (third === "main") {
    return { agentId };
  }

  if (third === "direct" && parts.length >= 4) {
    return {
      agentId,
      peer: {
        kind: "direct",
        id: parts.slice(3).join(":")
      }
    };
  }

  if (parts.length >= 5 && isPeerKind(parts[3])) {
    return {
      agentId,
      channel: parts[2],
      peer: {
        kind: parts[3],
        id: parts.slice(4).join(":")
      }
    };
  }

  if (parts.length >= 6 && isPeerKind(parts[4])) {
    return {
      agentId,
      channel: parts[2],
      accountId: parts[3],
      peer: {
        kind: parts[4],
        id: parts.slice(5).join(":")
      }
    };
  }

  return { agentId };
}

export function parseSimpleSessionKey(sessionKey?: string | null): ParsedSimpleSessionKey | null {
  const trimmed = (sessionKey ?? "").trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator >= trimmed.length - 1) {
    return null;
  }
  const channel = trimmed.slice(0, separator);
  const chatId = trimmed.slice(separator + 1);
  if (!channel || !chatId) {
    return null;
  }
  return { channel, chatId };
}

export function parseAgentSessionDeliveryRoute(sessionKey?: string | null): ResolvedSessionDeliveryRoute | null {
  const parsed = parseAgentScopedSessionKey(sessionKey);
  if (!parsed?.channel || !parsed.peer?.id) {
    return null;
  }
  return {
    channel: parsed.channel,
    chatId: parsed.peer.id,
    accountId: parsed.accountId,
  };
}

export function resolveSessionDeliveryRoute(
  session: { metadata: Record<string, unknown> } | null | undefined,
): ResolvedSessionDeliveryRoute | null {
  if (!session) {
    return null;
  }
  const metadata = session.metadata ?? {};
  const deliveryContext =
    metadata.last_delivery_context && typeof metadata.last_delivery_context === "object"
      ? (metadata.last_delivery_context as Record<string, unknown>)
      : undefined;
  const contextChannel = normalizeOptionalRouteString(deliveryContext?.channel);
  const contextChatId = normalizeOptionalRouteString(deliveryContext?.chatId);
  const fallbackChannel = normalizeOptionalRouteString(metadata.last_channel);
  const fallbackChatId = normalizeOptionalRouteString(metadata.last_to);
  const accountId =
    normalizeOptionalRouteString(deliveryContext?.accountId) ??
    normalizeOptionalRouteString(metadata.last_account_id) ??
    normalizeOptionalRouteString(metadata.last_accountId);
  const channel = contextChannel ?? fallbackChannel;
  const chatId = contextChatId ?? fallbackChatId;
  if (!channel || !chatId) {
    return null;
  }
  return {
    channel,
    chatId,
    accountId,
  };
}

export class AgentRouteResolver {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  updateConfig(config: Config): void {
    this.config = config;
  }

  resolveInbound(params: {
    message: InboundMessage;
    forcedAgentId?: string | null;
    sessionKeyOverride?: string | null;
  }): ResolvedAgentRoute {
    const channel = normalizeToken(params.message.channel, "unknown");
    const metadata = params.message.metadata ?? {};
    const accountId = resolveInboundAccountId(metadata);
    const peer = resolveInboundPeer(params.message);
    const fallbackAgentId = resolveDefaultAgentId(this.config);

    if (params.forcedAgentId) {
      const agentId = resolveKnownAgentId(this.config, params.forcedAgentId, fallbackAgentId);
      return {
        agentId,
        accountId,
        peer,
        sessionKey: (params.sessionKeyOverride ?? "").trim() || buildSessionKey({
          config: this.config,
          agentId,
          accountId,
          channel,
          peer
        }),
        matchedBy: "forced"
      };
    }

    for (const binding of this.config.bindings) {
      if (!matchesChannel(binding.match.channel, channel)) {
        continue;
      }
      if (!matchesAccountId(binding.match.accountId, accountId)) {
        continue;
      }
      if (!matchesPeer(binding.match.peer, peer)) {
        continue;
      }
      const agentId = resolveKnownAgentId(this.config, binding.agentId, fallbackAgentId);
      return {
        agentId,
        accountId,
        peer,
        sessionKey: (params.sessionKeyOverride ?? "").trim() || buildSessionKey({
          config: this.config,
          agentId,
          accountId,
          channel,
          peer
        }),
        matchedBy: "binding"
      };
    }

    const agentId = resolveKnownAgentId(this.config, undefined, fallbackAgentId);
    return {
      agentId,
      accountId,
      peer,
      sessionKey: (params.sessionKeyOverride ?? "").trim() || buildSessionKey({
        config: this.config,
        agentId,
        accountId,
        channel,
        peer
      }),
      matchedBy: "default"
    };
  }
}
