import { loadConfig, resolveConfigSecrets, saveConfig, type InboundAttachment } from "@nextclaw/core";
import { setPluginRuntimeBridge } from "@nextclaw/openclaw-compat";
import type { getPluginChannelBindings } from "@nextclaw/openclaw-compat";
import { mergePluginConfigView, toPluginConfigView } from "../../plugins.js";

type InstallPluginRuntimeBridgeParams = {
  dispatchPrompt: (params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    attachments?: InboundAttachment[];
    metadata?: Record<string, unknown>;
    agentId?: string;
  }) => Promise<string>;
  runtimeConfigPath: string;
  getPluginChannelBindings: () => ReturnType<typeof getPluginChannelBindings>;
};

type PluginRuntimeDispatchContext = {
  BodyForAgent?: unknown;
  Body?: unknown;
  SessionKey?: unknown;
  OriginatingChannel?: unknown;
  OriginatingTo?: unknown;
  SenderId?: unknown;
  AccountId?: unknown;
  AgentId?: unknown;
  Model?: unknown;
  AgentModel?: unknown;
  MediaPath?: unknown;
  MediaPaths?: unknown;
  MediaUrl?: unknown;
  MediaUrls?: unknown;
  MediaType?: unknown;
  MediaTypes?: unknown;
};

export function installPluginRuntimeBridge(params: InstallPluginRuntimeBridgeParams): void {
  const { dispatchPrompt, runtimeConfigPath, getPluginChannelBindings } = params;

  setPluginRuntimeBridge({
    loadConfig: () =>
      toPluginConfigView(resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }), getPluginChannelBindings()),
    writeConfigFile: async (nextConfigView) => {
      if (!nextConfigView || typeof nextConfigView !== "object" || Array.isArray(nextConfigView)) {
        throw new Error("plugin runtime writeConfigFile expects an object config");
      }
      const current = loadConfig();
      const next = mergePluginConfigView(current, nextConfigView, getPluginChannelBindings());
      saveConfig(next);
    },
    dispatchReplyWithBufferedBlockDispatcher: async ({ ctx, dispatcherOptions }) => {
      const request = resolvePluginRuntimeRequest(ctx as PluginRuntimeDispatchContext);
      if (!request) {
        return;
      }

      try {
        await dispatcherOptions.onReplyStart?.();
        const response = await dispatchPrompt(request);
        const replyText = typeof response === "string" ? response : String(response ?? "");
        if (replyText.trim()) {
          await dispatcherOptions.deliver({ text: replyText }, { kind: "final" });
        }
      } catch (error) {
        dispatcherOptions.onError?.(error);
        throw error;
      }
    }
  });
}

function resolvePluginRuntimeRequest(ctx: PluginRuntimeDispatchContext) {
  const bodyForAgent = typeof ctx.BodyForAgent === "string" ? ctx.BodyForAgent : "";
  const body = typeof ctx.Body === "string" ? ctx.Body : "";
  const content = (bodyForAgent || body).trim();
  const attachments = resolvePluginRuntimeAttachments(ctx);
  if (!content && attachments.length === 0) {
    return null;
  }

  const sessionKey = typeof ctx.SessionKey === "string" && ctx.SessionKey.trim().length > 0 ? ctx.SessionKey : undefined;
  const channel =
    typeof ctx.OriginatingChannel === "string" && ctx.OriginatingChannel.trim().length > 0
      ? ctx.OriginatingChannel
      : "cli";
  const chatId =
    typeof ctx.OriginatingTo === "string" && ctx.OriginatingTo.trim().length > 0
      ? ctx.OriginatingTo
      : typeof ctx.SenderId === "string" && ctx.SenderId.trim().length > 0
        ? ctx.SenderId
        : "direct";
  const agentId = typeof ctx.AgentId === "string" ? ctx.AgentId : undefined;
  const modelOverride = resolveModelOverride(ctx);
  const accountId = typeof ctx.AccountId === "string" && ctx.AccountId.trim().length > 0 ? ctx.AccountId : undefined;

  return {
    content,
    sessionKey,
    channel,
    chatId,
    agentId,
    attachments,
    metadata: {
      ...(accountId ? { account_id: accountId } : {}),
      ...(modelOverride ? { model: modelOverride } : {})
    }
  };
}

function resolveModelOverride(ctx: PluginRuntimeDispatchContext): string | undefined {
  if (typeof ctx.Model === "string" && ctx.Model.trim().length > 0) {
    return ctx.Model.trim();
  }
  if (typeof ctx.AgentModel === "string" && ctx.AgentModel.trim().length > 0) {
    return ctx.AgentModel.trim();
  }
  return undefined;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function resolvePluginRuntimeAttachments(ctx: PluginRuntimeDispatchContext): InboundAttachment[] {
  const mediaPaths = readStringList(ctx.MediaPaths);
  const mediaUrls = readStringList(ctx.MediaUrls);
  const fallbackPath = readOptionalString(ctx.MediaPath);
  const fallbackUrl = readOptionalString(ctx.MediaUrl);
  const mediaTypes = readStringList(ctx.MediaTypes);
  const fallbackType = readOptionalString(ctx.MediaType);
  const entryCount = Math.max(
    mediaPaths.length,
    mediaUrls.length,
    fallbackPath ? 1 : 0,
    fallbackUrl ? 1 : 0,
  );

  const attachments: InboundAttachment[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    const path = mediaPaths[index] ?? (index === 0 ? fallbackPath : undefined);
    const rawUrl = mediaUrls[index] ?? (index === 0 ? fallbackUrl : undefined);
    const url = rawUrl && rawUrl !== path ? rawUrl : undefined;
    const mimeType = mediaTypes[index] ?? fallbackType;
    if (!path && !url) {
      continue;
    }
    attachments.push({
      path,
      url,
      mimeType,
      source: "plugin-runtime",
      status: path ? "ready" : "remote-only",
    });
  }

  return attachments;
}
