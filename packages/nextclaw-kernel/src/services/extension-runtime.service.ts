import { randomUUID } from "node:crypto";
import {
  ingressKeys,
  type ExtensionChannelConfigGetIngressPayload,
  type ExtensionChannelMessageSubmitIngressPayload,
  type ExtensionResponseIngressPayload,
  type IngressContext,
  type IngressEnvelope,
} from "@nextclaw/shared";
import type {
  OpenClawChannelAuthLoginResult,
  OpenClawChannelAuthPollResult,
  OpenClawChannelAuthStartResult,
  PluginChannelBinding,
  PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import {
  ExtensionLifecycleService,
  ExtensionManifestDiscoveryService,
  resolveExtensionManifestRoots,
  type Config,
  type ExtensionChannelRequestKind,
  type ExtensionManifest,
  type ExtensionRequestSender,
  type ExtensionRuntimeContributions,
  type ExtensionRuntimeServiceOptions,
  type InboundAttachment,
  type InboundMessage,
  type PendingExtensionRequest,
} from "@kernel/features/extension-runtime/index.js";

const EXTENSION_REQUEST_EVENT_TYPE = "extension.request";
const EXTENSION_REQUEST_TIMEOUT_MS = 60_000;

type PluginChannelAuth = NonNullable<PluginChannelBinding["channel"]["auth"]>;
type PluginChannelOutbound = NonNullable<PluginChannelBinding["channel"]["outbound"]>;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRequiredString(value: unknown, name: string): string {
  const trimmed = readString(value);
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

function readTextContent(value: unknown): string {
  const content = readRecord(value);
  if (content.type !== "text" || typeof content.text !== "string") {
    throw new Error("only text channel messages are supported by the first ingress bridge");
  }
  return content.text;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readInboundAttachments(value: unknown): InboundAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object" && !Array.isArray(entry))
    )
    .map((entry) => ({
      ...(readString(entry.id) ? { id: readString(entry.id) } : {}),
      ...(readString(entry.name) ? { name: readString(entry.name) } : {}),
      ...(readString(entry.path) ? { path: readString(entry.path) } : {}),
      ...(readString(entry.url) ? { url: readString(entry.url) } : {}),
      ...(readString(entry.assetUri) ? { assetUri: readString(entry.assetUri) } : {}),
      ...(readString(entry.mimeType) ? { mimeType: readString(entry.mimeType) } : {}),
      ...(readOptionalNumber(entry.size) !== undefined ? { size: readOptionalNumber(entry.size) } : {}),
      ...(readString(entry.source) ? { source: readString(entry.source) } : {}),
      ...(entry.status === "ready" || entry.status === "remote-only" ? { status: entry.status } : {}),
      ...(readString(entry.errorCode) ? { errorCode: readString(entry.errorCode) as InboundAttachment["errorCode"] } : {}),
    }));
}

function toInboundMessage(value: unknown): InboundMessage {
  const payload = readRecord(value);
  return {
    channel: readRequiredString(payload.channelId, "channelId"),
    chatId: readRequiredString(payload.conversationId, "conversationId"),
    senderId: readRequiredString(payload.senderId, "senderId"),
    content: readTextContent(payload.content),
    timestamp: new Date(),
    attachments: readInboundAttachments(payload.attachments),
    metadata: readRecord(payload.metadata),
  };
}

class ExtensionChannelClient implements PluginChannelAuth, PluginChannelOutbound {
  constructor(
    private readonly params: {
      extensionId: string;
      channelId: string;
      request: ExtensionRequestSender;
    },
  ) {}

  readonly login: PluginChannelAuth["login"] = async ({ accountId, baseUrl, verbose }) =>
    await this.params.request<OpenClawChannelAuthLoginResult>({
      extensionId: this.params.extensionId,
      kind: "channel.auth.login",
      payload: {
        channelId: this.params.channelId,
        accountId,
        baseUrl,
        verbose,
      },
    });

  readonly start: PluginChannelAuth["start"] = async (params) =>
    await this.params.request<OpenClawChannelAuthStartResult>({
      extensionId: this.params.extensionId,
      kind: "channel.auth.start",
      payload: {
        channelId: this.params.channelId,
        accountId: params.accountId,
        baseUrl: params.baseUrl,
        domain: (params as { domain?: string | null }).domain,
      },
    });

  readonly poll: PluginChannelAuth["poll"] = async ({ sessionId }) =>
    await this.params.request<OpenClawChannelAuthPollResult | null>({
      extensionId: this.params.extensionId,
      kind: "channel.auth.poll",
      payload: {
        channelId: this.params.channelId,
        sessionId,
      },
    });

  readonly sendText: PluginChannelOutbound["sendText"] = async ({ to, text, accountId, replyTo, media, metadata }) =>
    await this.params.request({
      extensionId: this.params.extensionId,
      kind: "channel.outbound.sendText",
      payload: {
        channelId: this.params.channelId,
        to,
        text,
        accountId,
        replyTo,
        media,
        metadata,
      },
    });
}

export class ExtensionRuntimeService {
  readonly token = randomUUID();
  private readonly lifecycle = new ExtensionLifecycleService();
  private readonly pendingRequests = new Map<string, PendingExtensionRequest>();
  private manifests: ExtensionManifest[] = [];

  constructor(private readonly options: ExtensionRuntimeServiceOptions) {}

  readonly registerIngressHandlers = (): void => {
    this.options.ingress.addHandler(
      ingressKeys.extension.channelConfigGet,
      this.handleChannelConfigGet,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.channelMessageSubmit,
      this.handleChannelMessageSubmit,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.response,
      this.handleExtensionResponse,
    );
  };

  readonly loadChannelContributions = async (params: {
    config: Config;
    workspace: string;
  }): Promise<ExtensionRuntimeContributions> => {
    this.manifests = await this.discoverManifests(params);
    return this.toContributions(this.manifests);
  };

  readonly start = async (params: { endpoint: string | null }): Promise<void> => {
    const endpoint = params.endpoint?.trim();
    if (!endpoint) {
      return;
    }
    const manifests = this.manifests.length > 0
      ? this.manifests
      : await this.discoverManifests({
          config: this.options.getConfig(),
          workspace: this.options.getWorkspace(),
        });
    const running = this.lifecycle.startAll(manifests, {
      endpoint,
      token: this.token,
    });
    if (running.length > 0) {
      console.log(`✓ Extensions started: ${running.map((entry) => entry.manifest.id).join(", ")}`);
    }
  };

  readonly stop = async (): Promise<void> => {
    await this.lifecycle.stopAll();
    for (const [requestId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error(`Extension request cancelled: ${requestId}`));
    }
    this.pendingRequests.clear();
  };

  private readonly discoverManifests = async (params: {
    config: Config;
    workspace: string;
  }): Promise<ExtensionManifest[]> => {
    const discovery = new ExtensionManifestDiscoveryService();
    return await discovery.discover(resolveExtensionManifestRoots(params));
  };

  private readonly toContributions = (manifests: ExtensionManifest[]): ExtensionRuntimeContributions => {
    const channelBindings: PluginChannelBinding[] = [];
    const uiMetadata: PluginUiMetadata[] = [];
    for (const manifest of manifests) {
      for (const channel of manifest.contributes?.channels ?? []) {
        const channelId = readString(channel.id);
        if (!channelId) {
          continue;
        }
        const configUiHints = this.readConfigUiHints(channel.configUiHints);
        channelBindings.push({
          pluginId: manifest.id,
          channelId,
          channel: {
            id: channelId,
            meta: {
              label: channel.name ?? channelId,
              selectionLabel: channel.name ?? channelId,
              ...(channel.description ? { blurb: channel.description } : {}),
              ...(channel.meta ?? {}),
            },
            ...(channel.configSchema ? {
              configSchema: {
                schema: channel.configSchema,
                ...(configUiHints ? { uiHints: configUiHints } : {}),
              },
            } : {}),
            ...(channel.auth ? { auth: this.createChannelAuth(manifest.id, channelId) } : {}),
            outbound: this.createChannelOutbound(manifest.id, channelId),
          },
        });
        uiMetadata.push({
          id: manifest.id,
          configSchema: channel.configSchema,
          ...(configUiHints ? { configUiHints } : {}),
        });
      }
    }
    return { channelBindings, uiMetadata };
  };

  private readonly handleChannelConfigGet = (
    envelope: IngressEnvelope<ExtensionChannelConfigGetIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(context);
    const payload = readRecord(envelope.payload);
    const channelId = readRequiredString(payload.channelId, "channelId");
    return {
      config: (this.options.getConfig().channels as Record<string, unknown>)[channelId] ?? {},
    };
  };

  private readonly handleChannelMessageSubmit = async (
    envelope: IngressEnvelope<ExtensionChannelMessageSubmitIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(context);
    await this.options.messageBus.publishInbound(toInboundMessage(envelope.payload));
    return { accepted: true };
  };

  private readonly handleExtensionResponse = (
    envelope: IngressEnvelope<ExtensionResponseIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(context);
    const payload = readRecord(envelope.payload);
    const requestId = readRequiredString(payload.requestId, "requestId");
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return { accepted: false };
    }
    this.pendingRequests.delete(requestId);
    clearTimeout(pending.timeout);
    if (payload.ok === false) {
      const error = readRecord(payload.error);
      const message = readString(error.message) ?? "Extension request failed";
      pending.reject(new Error(message));
      return { accepted: true };
    }
    pending.resolve(payload.data);
    return { accepted: true };
  };

  private readonly readConfigUiHints = (
    value: unknown,
  ): PluginUiMetadata["configUiHints"] | undefined => {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as PluginUiMetadata["configUiHints"]
      : undefined;
  };

  private readonly createChannelAuth = (
    extensionId: string,
    channelId: string,
  ): PluginChannelAuth =>
    new ExtensionChannelClient({
      extensionId,
      channelId,
      request: this.requestExtension,
    });

  private readonly createChannelOutbound = (
    extensionId: string,
    channelId: string,
  ): PluginChannelOutbound =>
    new ExtensionChannelClient({
      extensionId,
      channelId,
      request: this.requestExtension,
    });

  private readonly requestExtension = async <T>(params: {
    extensionId: string;
    kind: ExtensionChannelRequestKind;
    payload: Record<string, unknown>;
  }): Promise<T> => {
    const requestId = randomUUID();
    const result = new Promise<T>((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        rejectPromise(new Error(`Extension request timed out: ${params.kind}`));
      }, EXTENSION_REQUEST_TIMEOUT_MS);
      this.pendingRequests.set(requestId, {
        resolve: (value) => resolvePromise(value as T),
        reject: rejectPromise,
        timeout,
      });
    });
    this.options.eventBus.emitEnvelope({
      type: EXTENSION_REQUEST_EVENT_TYPE,
      payload: {
        requestId,
        extensionId: params.extensionId,
        kind: params.kind,
        payload: params.payload,
      },
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
    return await result;
  };

  private readonly assertAuthorized = (context: IngressContext): void => {
    if (context.token !== this.token) {
      throw new Error("Unauthorized ingress token");
    }
  };
}
