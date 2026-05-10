import type * as NextclawCore from "@nextclaw/core";
import { getDataPath } from "@nextclaw/core";
import type { UiWebhookContext, UiWebhookEnvelope } from "@nextclaw/server";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
  ExtensionLifecycleService,
  ExtensionManifestDiscoveryService,
  type RunningExtensionProcess,
} from "./extension-lifecycle.service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";
import type { WebhookService } from "@nextclaw-service/shared/services/webhook/webhook.service.js";

type Config = NextclawCore.Config;
type InboundAttachment = NextclawCore.InboundAttachment;
type InboundMessage = NextclawCore.InboundMessage;

const EXTENSION_CONFIG_GET_WEBHOOK_TYPE = "extension.channel.config.get";
const EXTENSION_MESSAGE_SUBMIT_WEBHOOK_TYPE = "extension.channel.message.submit";

type ChannelSubmittedMessagePayload = {
  channelId?: unknown;
  conversationId?: unknown;
  senderId?: unknown;
  content?: unknown;
  metadata?: unknown;
};

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const path of paths) {
    const normalized = resolve(path);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function readTextContent(value: unknown): string {
  const content = readRecord(value);
  if (content.type !== "text" || typeof content.text !== "string") {
    throw new Error("only text channel messages are supported by the first webhook bridge");
  }
  return content.text;
}

function toInboundMessage(payload: ChannelSubmittedMessagePayload): InboundMessage {
  const metadata = readRecord(payload.metadata);
  return {
    channel: readRequiredString(payload.channelId, "channelId"),
    chatId: readRequiredString(payload.conversationId, "conversationId"),
    senderId: readRequiredString(payload.senderId, "senderId"),
    content: readTextContent(payload.content),
    timestamp: new Date(),
    attachments: [] satisfies InboundAttachment[],
    metadata,
  };
}

export function resolveExtensionManifestRoots(params: {
  config: Config;
  workspace: string;
}): string[] {
  return uniquePaths([
    join(getDataPath(), "extensions"),
    join(params.workspace, ".nextclaw", "extensions"),
    ...(params.config.plugins.load?.paths ?? []),
  ]);
}

export async function startDiscoveredExtensions(params: {
  config: Config;
  workspace: string;
  endpoint: string;
  token: string;
  discovery?: ExtensionManifestDiscoveryService;
  lifecycle?: ExtensionLifecycleService;
}): Promise<{
  lifecycle: ExtensionLifecycleService;
  running: RunningExtensionProcess[];
}> {
  const { config, discovery: providedDiscovery, endpoint, lifecycle: providedLifecycle, token, workspace } = params;
  const discovery = providedDiscovery ?? new ExtensionManifestDiscoveryService();
  const lifecycle =
    providedLifecycle ??
    new ExtensionLifecycleService({
      endpoint,
      token,
    });
  const manifests = await discovery.discover(
    resolveExtensionManifestRoots({
      config,
      workspace,
    }),
  );
  return {
    lifecycle,
    running: await lifecycle.startAll(manifests),
  };
}

export class ServiceExtensionRuntime {
  readonly token = randomUUID();
  private lifecycle: ExtensionLifecycleService | null = null;

  constructor(private readonly gateway: NextclawGatewayRuntime) {}

  readonly registerWebhookHandlers = (webhook: WebhookService): void => {
    webhook.addHandler(
      EXTENSION_CONFIG_GET_WEBHOOK_TYPE,
      this.handleChannelConfigGet,
    );
    webhook.addHandler(
      EXTENSION_MESSAGE_SUBMIT_WEBHOOK_TYPE,
      this.handleChannelMessageSubmit,
    );
  };

  readonly start = async (): Promise<void> => {
    const endpoint = this.gateway.uiStartup.endpoint || null;
    if (!endpoint) {
      return;
    }
    const started = await startDiscoveredExtensions({
      config: this.gateway.configManager.loadGatewayConfig(),
      workspace: this.gateway.workspaceManager.workspace,
      endpoint,
      token: this.token,
      lifecycle: this.lifecycle ?? undefined,
    });
    this.lifecycle = started.lifecycle;
    if (started.running.length > 0) {
      console.log(`✓ Extensions started: ${started.running.map((entry) => entry.manifest.id).join(", ")}`);
    }
  };

  readonly stop = async (): Promise<void> => {
    await this.lifecycle?.stopAll();
    this.lifecycle = null;
  };

  private readonly handleChannelConfigGet = (
    envelope: UiWebhookEnvelope,
    context: UiWebhookContext,
  ) => {
    this.assertAuthorized(context);
    const payload = readRecord(envelope.payload);
    const channelId = readRequiredString(payload.channelId, "channelId");
    return {
      config: (this.gateway.configManager.loadGatewayConfig().channels as Record<string, unknown>)[channelId] ?? {},
    };
  };

  private readonly handleChannelMessageSubmit = async (
    envelope: UiWebhookEnvelope,
    context: UiWebhookContext,
  ) => {
    this.assertAuthorized(context);
    await this.gateway.messageBus.publishInbound(toInboundMessage(readRecord(envelope.payload)));
    return { accepted: true };
  };

  private readonly assertAuthorized = (context: UiWebhookContext): void => {
    if (context.token !== this.token) {
      throw new Error("Unauthorized webhook token");
    }
  };
}
