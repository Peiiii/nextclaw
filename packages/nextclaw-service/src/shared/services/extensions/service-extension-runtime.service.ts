import type * as NextclawCore from "@nextclaw/core";
import { getDataPath } from "@nextclaw/core";
import type { Ingress, IngressContext, IngressEnvelope } from "@nextclaw/kernel";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { resolveDevFirstPartyPluginDir } from "@nextclaw-service/commands/plugin/development-source/first-party-plugin-load-paths.js";
import {
  ExtensionLifecycleService,
  ExtensionManifestDiscoveryService,
  type RunningExtensionProcess,
} from "./extension-lifecycle.service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

type Config = NextclawCore.Config;
type InboundAttachment = NextclawCore.InboundAttachment;
type InboundMessage = NextclawCore.InboundMessage;

const EXTENSION_CONFIG_GET_INGRESS_TYPE = "extension.channel.config.get";
const EXTENSION_MESSAGE_SUBMIT_INGRESS_TYPE = "extension.channel.message.submit";
const BUILTIN_EXTENSION_PACKAGES = ["@nextclaw/channel-extension-weixin"] as const;
const serviceRequire = createRequire(import.meta.url);

type ChannelSubmittedMessagePayload = {
  channelId?: unknown;
  conversationId?: unknown;
  senderId?: unknown;
  content?: unknown;
  attachments?: unknown;
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

function resolveWorkspaceBuiltinExtensionManifestRoot(packageName: string): string | undefined {
  if (packageName !== "@nextclaw/channel-extension-weixin") {
    return undefined;
  }
  const root = resolve(process.cwd(), "packages", "extensions", "nextclaw-channel-extension-weixin");
  return existsSync(join(root, "nextclaw.extension.json")) ? root : undefined;
}

export function resolveBuiltinExtensionManifestRoots(): string[] {
  const roots: string[] = [];
  for (const packageName of BUILTIN_EXTENSION_PACKAGES) {
    try {
      const entryPath = serviceRequire.resolve(packageName);
      const root = findExtensionManifestRoot(dirname(entryPath));
      if (root) {
        roots.push(root);
        continue;
      }
    } catch {
      // Package-manager installs may omit optional built-ins in development workspaces.
    }
    const workspaceRoot = resolveWorkspaceBuiltinExtensionManifestRoot(packageName);
    if (workspaceRoot) {
      roots.push(workspaceRoot);
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

function toInboundMessage(payload: ChannelSubmittedMessagePayload): InboundMessage {
  const metadata = readRecord(payload.metadata);
  return {
    channel: readRequiredString(payload.channelId, "channelId"),
    chatId: readRequiredString(payload.conversationId, "conversationId"),
    senderId: readRequiredString(payload.senderId, "senderId"),
    content: readTextContent(payload.content),
    timestamp: new Date(),
    attachments: readInboundAttachments(payload.attachments),
    metadata,
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

  readonly registerIngressHandlers = (ingress: Ingress): void => {
    ingress.addHandler(
      EXTENSION_CONFIG_GET_INGRESS_TYPE,
      this.handleChannelConfigGet,
    );
    ingress.addHandler(
      EXTENSION_MESSAGE_SUBMIT_INGRESS_TYPE,
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
    envelope: IngressEnvelope,
    context: IngressContext,
  ) => {
    this.assertAuthorized(context);
    const payload = readRecord(envelope.payload);
    const channelId = readRequiredString(payload.channelId, "channelId");
    return {
      config: (this.gateway.configManager.loadGatewayConfig().channels as Record<string, unknown>)[channelId] ?? {},
    };
  };

  private readonly handleChannelMessageSubmit = async (
    envelope: IngressEnvelope,
    context: IngressContext,
  ) => {
    this.assertAuthorized(context);
    await this.gateway.messageBus.publishInbound(toInboundMessage(readRecord(envelope.payload)));
    return { accepted: true };
  };

  private readonly assertAuthorized = (context: IngressContext): void => {
    if (context.token !== this.token) {
      throw new Error("Unauthorized ingress token");
    }
  };
}
