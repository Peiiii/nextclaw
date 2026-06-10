import {
  parseAgentScopedSessionKey,
} from "@nextclaw/core";
import type { ServiceGatewayManager } from "@nextclaw-service/managers/service-gateway.manager.js";
import {
  consumeRestartSentinel,
  formatRestartSentinelMessage,
  parseSessionKey,
} from "@nextclaw-service/utils/restart-sentinel.utils.js";
import { resolveSessionRouteCandidate } from "@nextclaw-service/services/runtime/service-managed-startup.service.js";

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export class GatewayRestartWakeService {
  constructor(private readonly gateway: ServiceGatewayManager) {}

  wakeFromRestartSentinel = async (): Promise<void> => {
    const sentinel = await consumeRestartSentinel();
    if (!sentinel) {
      return;
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));

    const payload = sentinel.payload;
    const summary = formatRestartSentinelMessage(payload);
    const sentinelSessionKey = normalizeOptionalString(payload.sessionKey);
    const fallbackSessionKey = sentinelSessionKey ? undefined : await this.resolveMostRecentRoutableSessionKey();
    if (!sentinelSessionKey && fallbackSessionKey) {
      console.warn(`Warning: restart sentinel missing sessionKey; fallback to ${fallbackSessionKey}.`);
    }
    const sessionKey = sentinelSessionKey ?? fallbackSessionKey ?? "cli:default";
    const parsedSession = parseSessionKey(sessionKey);
    const parsedAgentSession = parseAgentScopedSessionKey(sessionKey);
    const parsedSessionRoute = parsedSession && parsedSession.channel !== "agent" ? parsedSession : null;

    const context = payload.deliveryContext;
    const fallbackSession = await this.gateway.sessionManager.getSessionRecord(sessionKey);
    const fallbackMetadata = fallbackSession?.metadata ?? {};
    const channel =
      normalizeOptionalString(context?.channel) ??
      parsedSessionRoute?.channel ??
      normalizeOptionalString(fallbackMetadata.last_channel);
    const chatId =
      normalizeOptionalString(context?.chatId) ??
      parsedSessionRoute?.chatId ??
      normalizeOptionalString(fallbackMetadata.last_to);
    const replyTo = normalizeOptionalString(context?.replyTo);
    const accountId = normalizeOptionalString(context?.accountId);

    if (!channel || !chatId) {
      console.warn(`Warning: restart sentinel cannot resolve route for session ${sessionKey}.`);
      return;
    }

    await this.gateway.messageBus.publishInbound({
      channel: "system",
      senderId: "restart-sentinel",
      chatId: `${channel}:${chatId}`,
      content: this.buildRestartWakePrompt({
        summary,
        reason: normalizeOptionalString(payload.stats?.reason),
        note: normalizeOptionalString(payload.message),
        ...(replyTo ? { replyTo } : {}),
      }),
      timestamp: new Date(),
      attachments: [],
      metadata: {
        source: "restart-sentinel",
        restart_summary: summary,
        session_key_override: sessionKey,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(parsedAgentSession ? { target_agent_id: parsedAgentSession.agentId } : {}),
        ...(accountId ? { account_id: accountId, accountId } : {}),
      },
    });
  };

  private resolveMostRecentRoutableSessionKey = async (): Promise<string | undefined> => {
    let best: { key: string; updatedAt: number } | null = null;
    for (const session of await this.gateway.sessionManager.listSessions()) {
      const candidate = resolveSessionRouteCandidate({
        session: {
          key: session.sessionId,
          updated_at: session.updatedAt,
          metadata: session.metadata,
        },
        normalizeOptionalString,
      });
      if (!candidate) {
        continue;
      }
      if (!best || candidate.updatedAt >= best.updatedAt) {
        best = candidate;
      }
    }
    return best?.key;
  };

  private buildRestartWakePrompt = (params: {
    summary: string;
    reason?: string;
    note?: string;
    replyTo?: string;
  }): string => {
    const { note, reason, replyTo, summary } = params;
    const lines = [
      "System event: the gateway has restarted successfully.",
      "Please send one short confirmation to the user that you are back online.",
      "Do not call any tools.",
      "Use the same language as the user's recent conversation.",
      `Reference summary: ${summary}`,
    ];

    const normalizedReason = normalizeOptionalString(reason);
    if (normalizedReason) {
      lines.push(`Restart reason: ${normalizedReason}`);
    }

    const normalizedNote = normalizeOptionalString(note);
    if (normalizedNote) {
      lines.push(`Extra note: ${normalizedNote}`);
    }

    const normalizedReplyTo = normalizeOptionalString(replyTo);
    if (normalizedReplyTo) {
      lines.push(`Reply target message id: ${normalizedReplyTo}. If suitable, include [[reply_to:${normalizedReplyTo}]].`);
    }

    return lines.join("\n");
  };
}
