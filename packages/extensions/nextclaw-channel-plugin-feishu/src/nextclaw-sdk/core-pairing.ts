import { normalizeAccountId } from "./account-id.js";
import type { LogFn, PluginRuntime } from "./types.js";

export const PAIRING_APPROVED_MESSAGE =
  "NextClaw access approved. Send a message to start chatting.";

const NEXTCLAW_DOCS_ROOT = "https://docs.nextclaw.io";

export function buildAgentMediaPayload(
  mediaList: Array<{ path: string; contentType?: string | null }>,
): {
  MediaPath?: string;
  MediaType?: string;
  MediaUrl?: string;
  MediaPaths?: string[];
  MediaUrls?: string[];
  MediaTypes?: string[];
} {
  const first = mediaList[0];
  const mediaPaths = mediaList.map((media) => media.path);
  const mediaTypes = mediaList.map((media) => media.contentType).filter(Boolean) as string[];
  return {
    MediaPath: first?.path,
    MediaType: first?.contentType ?? undefined,
    MediaUrl: first?.path,
    MediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
    MediaUrls: mediaPaths.length > 0 ? mediaPaths : undefined,
    MediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
  };
}

export function formatDocsLink(path: string, label?: string): string {
  const trimmed = path.trim();
  const url = trimmed.startsWith("http")
    ? trimmed
    : `${NEXTCLAW_DOCS_ROOT}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  return label ? `${label} (${url})` : url;
}

function buildPairingReply(params: {
  channel: string;
  idLine: string;
  code: string;
}): string {
  return [
    "NextClaw: access not configured.",
    "",
    params.idLine,
    "",
    `Pairing code: ${params.code}`,
    "",
    "Ask the bot owner to approve with:",
    `nextclaw pairing approve ${params.channel} ${params.code}`,
  ].join("\n");
}

export async function issuePairingChallenge(params: {
  channel: string;
  senderId: string;
  senderIdLine: string;
  meta?: Record<string, string | undefined>;
  upsertPairingRequest: (params: {
    id: string;
    meta?: Record<string, string | undefined>;
  }) => Promise<{ code: string; created: boolean }>;
  sendPairingReply: (text: string) => Promise<void>;
  buildReplyText?: (params: { code: string; senderIdLine: string }) => string;
  onCreated?: (params: { code: string }) => void;
  onReplyError?: (err: unknown) => void;
}): Promise<{ created: boolean; code?: string }> {
  const { code, created } = await params.upsertPairingRequest({
    id: params.senderId,
    meta: params.meta,
  });
  if (!created) {
    return { created: false };
  }
  params.onCreated?.({ code });
  const replyText =
    params.buildReplyText?.({ code, senderIdLine: params.senderIdLine }) ??
    buildPairingReply({
      channel: params.channel,
      idLine: params.senderIdLine,
      code,
    });
  try {
    await params.sendPairingReply(replyText);
  } catch (error) {
    params.onReplyError?.(error);
  }
  return { created: true, code };
}

export function createScopedPairingAccess(params: {
  core: PluginRuntime;
  channel: string;
  accountId: string;
}) {
  const accountId = normalizeAccountId(params.accountId);
  return {
    accountId,
    readAllowFromStore: () =>
      params.core.channel.pairing.readAllowFromStore({
        channel: params.channel,
        accountId,
      }),
    readStoreForDmPolicy: (provider: string, providerAccountId: string) =>
      params.core.channel.pairing.readAllowFromStore({
        channel: provider,
        accountId: normalizeAccountId(providerAccountId),
      }),
    upsertPairingRequest: (input: {
      id: string;
      meta?: Record<string, string | undefined>;
    }) =>
      params.core.channel.pairing.upsertPairingRequest({
        channel: params.channel,
        accountId,
        ...input,
      }),
  };
}

export function createReplyPrefixContext() {
  const prefixContext: Record<string, unknown> = {};
  return {
    prefixContext,
    responsePrefix: undefined as string | undefined,
    enableSlackInteractiveReplies: undefined as boolean | undefined,
    responsePrefixContextProvider: () => prefixContext,
    onModelSelected: (_ctx: Record<string, unknown>) => {},
  };
}

export function logTypingFailure(params: {
  log: LogFn;
  channel: string;
  target?: string;
  action?: "start" | "stop";
  error: unknown;
}): void {
  const target = params.target ? ` target=${params.target}` : "";
  const action = params.action ? ` action=${params.action}` : "";
  params.log(`${params.channel} typing${action} failed${target}: ${String(params.error)}`);
}

export function createTypingCallbacks(params: {
  start: () => Promise<void>;
  stop?: () => Promise<void>;
  onStartError: (err: unknown) => void;
  onStopError?: (err: unknown) => void;
  keepaliveIntervalMs?: number;
  maxConsecutiveFailures?: number;
  maxDurationMs?: number;
}) {
  const keepaliveIntervalMs = params.keepaliveIntervalMs ?? 3_000;
  const maxConsecutiveFailures = Math.max(1, params.maxConsecutiveFailures ?? 2);
  const maxDurationMs = params.maxDurationMs ?? 60_000;
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let stopSent = false;
  let consecutiveFailures = 0;

  const cleanupTimers = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  };

  const fireStop = () => {
    cleanupTimers();
    closed = true;
    if (!params.stop || stopSent) {
      return;
    }
    stopSent = true;
    void params.stop().catch((error) => (params.onStopError ?? params.onStartError)(error));
  };

  const fireStart = async () => {
    if (closed) {
      return;
    }
    try {
      await params.start();
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      params.onStartError(error);
      if (consecutiveFailures >= maxConsecutiveFailures) {
        fireStop();
      }
    }
  };

  return {
    onReplyStart: async () => {
      closed = false;
      stopSent = false;
      consecutiveFailures = 0;
      cleanupTimers();
      await fireStart();
      if (closed) {
        return;
      }
      interval = setInterval(() => {
        void fireStart();
      }, keepaliveIntervalMs);
      if (maxDurationMs > 0) {
        timeout = setTimeout(() => {
          fireStop();
        }, maxDurationMs);
      }
    },
    onIdle: fireStop,
    onCleanup: fireStop,
  };
}
