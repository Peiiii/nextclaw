import type * as NextclawCore from "@nextclaw/core";
import { getDataPath } from "@nextclaw/core";
import {
  ingressKeys,
  type ExtensionChannelConfigGetIngressPayload,
  type ExtensionChannelMessageSubmitIngressPayload,
  type ExtensionResponseIngressPayload,
  type Ingress,
  type IngressContext,
  type IngressEnvelope,
} from "@nextclaw/shared";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  OpenClawChannelAuthLoginResult,
  OpenClawChannelAuthPollResult,
  OpenClawChannelAuthStartResult,
  PluginChannelBinding,
  PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import { resolveDevFirstPartyPluginDir } from "@nextclaw-service/commands/plugin/development-source/first-party-plugin-load-paths.utils.js";
import {
  ExtensionLifecycleService,
  ExtensionManifestDiscoveryService,
  type ExtensionManifest,
} from "./extension-lifecycle.service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

type Config = NextclawCore.Config;
type InboundAttachment = NextclawCore.InboundAttachment;
type InboundMessage = NextclawCore.InboundMessage;

const EXTENSION_REQUEST_EVENT_TYPE = "extension.request";
const serviceRequire = createRequire(import.meta.url);
const EXTENSION_REQUEST_TIMEOUT_MS = 60_000;

type ExtensionChannelRequestKind =
  | "channel.auth.login"
  | "channel.auth.start"
  | "channel.auth.poll"
  | "channel.outbound.sendText";

type ExtensionRuntimeContributions = {
  channelBindings: PluginChannelBinding[];
  uiMetadata: PluginUiMetadata[];
};

type PendingExtensionRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type PluginChannelAuth = NonNullable<PluginChannelBinding["channel"]["auth"]>;
type PluginChannelOutbound = NonNullable<PluginChannelBinding["channel"]["outbound"]>;

type ExtensionRequestSender = <T>(params: {
  extensionId: string;
  kind: ExtensionChannelRequestKind;
  payload: Record<string, unknown>;
}) => Promise<T>;

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

  readonly sendText: PluginChannelOutbound["sendText"] = async ({ to, text, accountId }) =>
    await this.params.request({
      extensionId: this.params.extensionId,
      kind: "channel.outbound.sendText",
      payload: {
        channelId: this.params.channelId,
        to,
        text,
        accountId,
      },
    });
}

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

function findExtensionManifestRoot(startPath: string): string | undefined {
  let current = resolve(startPath);
  while (true) {
    if (existsSync(join(current, "nextclaw.extension.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function readBuiltinExtensionPackages(): string[] {
  if (process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS === "1") {
    return [];
  }
  const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..", "package.json");
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      nextclaw?: {
        builtinExtensions?: unknown;
      };
    };
    const packages = packageJson.nextclaw?.builtinExtensions;
    return Array.isArray(packages)
      ? packages.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function resolveBuiltinExtensionManifestRoots(): string[] {
  const roots: string[] = [];
  for (const packageName of readBuiltinExtensionPackages()) {
    try {
      const entryPath = serviceRequire.resolve(packageName);
      const root = findExtensionManifestRoot(dirname(entryPath));
      if (root) {
        roots.push(root);
      }
    } catch {
      // Package-manager installs may omit optional built-ins in development workspaces.
    }
  }
  return uniquePaths(roots);
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
    throw new Error("only text channel messages are supported by the first ingress bridge");
  }
  return content.text;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
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
      ...(readOptionalString(entry.id) ? { id: readOptionalString(entry.id) } : {}),
      ...(readOptionalString(entry.name) ? { name: readOptionalString(entry.name) } : {}),
      ...(readOptionalString(entry.path) ? { path: readOptionalString(entry.path) } : {}),
      ...(readOptionalString(entry.url) ? { url: readOptionalString(entry.url) } : {}),
      ...(readOptionalString(entry.assetUri) ? { assetUri: readOptionalString(entry.assetUri) } : {}),
      ...(readOptionalString(entry.mimeType) ? { mimeType: readOptionalString(entry.mimeType) } : {}),
      ...(readOptionalNumber(entry.size) !== undefined ? { size: readOptionalNumber(entry.size) } : {}),
      ...(readOptionalString(entry.source) ? { source: readOptionalString(entry.source) } : {}),
      ...(entry.status === "ready" || entry.status === "remote-only" ? { status: entry.status } : {}),
      ...(readOptionalString(entry.errorCode) ? { errorCode: readOptionalString(entry.errorCode) as InboundAttachment["errorCode"] } : {}),
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

export function resolveExtensionManifestRoots(params: {
  config: Config;
  workspace: string;
}): string[] {
  const devExtensionsDir = resolveDevFirstPartyPluginDir(process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR);
  return uniquePaths([
    join(getDataPath(), "extensions"),
    join(params.workspace, ".nextclaw", "extensions"),
    ...(devExtensionsDir ? [devExtensionsDir] : []),
    ...resolveBuiltinExtensionManifestRoots(),
    ...(params.config.plugins.load?.paths ?? []),
  ]);
}

export class ServiceExtensionRuntime {
  readonly token = randomUUID();
  private lifecycle: ExtensionLifecycleService | null = null;
  private manifests: ExtensionManifest[] = [];
  private readonly pendingRequests = new Map<string, PendingExtensionRequest>();

  constructor(private readonly gateway: NextclawGatewayRuntime) {}

  readonly registerIngressHandlers = (ingress: Ingress): void => {
    ingress.addHandler(
      ingressKeys.extension.channelConfigGet,
      this.handleChannelConfigGet,
    );
    ingress.addHandler(
      ingressKeys.extension.channelMessageSubmit,
      this.handleChannelMessageSubmit,
    );
    ingress.addHandler(
      ingressKeys.extension.response,
      this.handleExtensionResponse,
    );
  };

  readonly loadContributions = async (): Promise<ExtensionRuntimeContributions> => {
    this.manifests = await this.discoverManifests();
    return this.toContributions(this.manifests);
  };

  readonly start = async (): Promise<void> => {
    const endpoint = this.gateway.uiStartup.endpoint || null;
    if (!endpoint) {
      return;
    }
    const lifecycle =
      this.lifecycle ??
      new ExtensionLifecycleService({
        endpoint,
        token: this.token,
      });
    const manifests = this.manifests.length > 0 ? this.manifests : await this.discoverManifests();
    const running = await lifecycle.startAll(manifests);
    this.lifecycle = lifecycle;
    if (running.length > 0) {
      console.log(`✓ Extensions started: ${running.map((entry) => entry.manifest.id).join(", ")}`);
    }
  };

  readonly stop = async (): Promise<void> => {
    await this.lifecycle?.stopAll();
    this.lifecycle = null;
    for (const [requestId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error(`Extension request cancelled: ${requestId}`));
    }
    this.pendingRequests.clear();
  };

  private readonly handleChannelConfigGet = (
    envelope: IngressEnvelope<ExtensionChannelConfigGetIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(context);
    const payload = readRecord(envelope.payload);
    const channelId = readRequiredString(payload.channelId, "channelId");
    return {
      config: (this.gateway.configManager.loadConfig().channels as Record<string, unknown>)[channelId] ?? {},
    };
  };

  private readonly handleChannelMessageSubmit = async (
    envelope: IngressEnvelope<ExtensionChannelMessageSubmitIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(context);
    await this.gateway.messageBus.publishInbound(toInboundMessage(envelope.payload));
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
      const message = typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : "Extension request failed";
      pending.reject(new Error(message));
      return { accepted: true };
    }
    pending.resolve(payload.data);
    return { accepted: true };
  };

  private readonly discoverManifests = async (): Promise<ExtensionManifest[]> => {
    const discovery = new ExtensionManifestDiscoveryService();
    return await discovery.discover(resolveExtensionManifestRoots({
      config: this.gateway.configManager.loadConfig(),
      workspace: this.gateway.workspace,
    }));
  };

  private readonly toContributions = (manifests: ExtensionManifest[]): ExtensionRuntimeContributions => {
    const channelBindings: PluginChannelBinding[] = [];
    const uiMetadata: PluginUiMetadata[] = [];
    for (const manifest of manifests) {
      const channels = manifest.contributes?.channels ?? [];
      for (const channel of channels) {
        const channelId = readOptionalString(channel.id);
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
            ...(channel.outbound?.text ? { outbound: this.createChannelOutbound(manifest.id, channelId) } : {}),
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

  private readonly readConfigUiHints = (
    value: unknown,
  ): PluginUiMetadata["configUiHints"] | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as PluginUiMetadata["configUiHints"];
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
    this.gateway.appEventBus.emitEnvelope({
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
