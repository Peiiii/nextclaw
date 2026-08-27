import { randomUUID } from "node:crypto";
import {
  ingressKeys,
  type ExtensionChannelCommandExecuteIngressPayload,
  type ExtensionChannelCommandListIngressPayload,
  type ExtensionChannelConfigGetIngressPayload,
  type ExtensionChannelMessageSubmitIngressPayload,
  type ExtensionDiagnosticIngressPayload,
  type ExtensionRuntimeReadyIngressPayload,
  type ExtensionResponseIngressPayload,
  type IngressContext,
  type IngressEnvelope,
} from "@nextclaw/shared";
import { AgentRouteResolver } from "@nextclaw/core";
import { CommandRegistry } from "@kernel/services/command-registry.service.js";
import {
  ExtensionAuthLeaseService,
  ExtensionContributionsService,
  ExtensionIngressDiagnosticsService,
  ExtensionLifecycleService,
  ExtensionManifestDiscoveryService,
  ExtensionObservationRuntimeService,
  ExtensionDesktopRuntimeService,
  readOptionalNumber,
  readRecord,
  readRequiredString,
  readString,
  resolveExtensionManifestRoots,
  toInboundMessage,
  type Config,
  type ExtensionLease,
  type ExtensionChannelRequestKind,
  type ExtensionObservationRequestKind,
  type ExtensionManifest,
  type ExtensionProcessExitEvent,
  type ExtensionRuntimeContributions,
  type ExtensionRuntimeServiceOptions,
  type PendingExtensionRequest,
} from "@kernel/features/extension-runtime/index.js";
import type { DesktopHostCapabilityManager } from "@kernel/features/desktop-host/index.js";

const EXTENSION_REQUEST_EVENT_TYPE = "extension.request";
const EXTENSION_REQUEST_TIMEOUT_MS = 60_000;

export class ExtensionRuntimeService {
  private readonly authLeases: ExtensionAuthLeaseService;
  private readonly lifecycle: ExtensionLifecycleService;
  private readonly ingressDiagnostics: ExtensionIngressDiagnosticsService;
  private readonly manifestDiscovery = new ExtensionManifestDiscoveryService();
  private readonly contributions: ExtensionContributionsService;
  private readonly pendingRequests = new Map<string, PendingExtensionRequest>();
  private readonly persistentLeases = new Map<string, ExtensionLease>();
  private readonly desktopRuntime: ExtensionDesktopRuntimeService;
  readonly observations: ExtensionObservationRuntimeService;
  private endpoint: string | null = null;
  private manifests: ExtensionManifest[] = [];

  constructor(private readonly options: ExtensionRuntimeServiceOptions) {
    this.ingressDiagnostics = new ExtensionIngressDiagnosticsService(
      options.diagnostics,
    );
    this.contributions = new ExtensionContributionsService({
      request: this.requestExtension,
    });
    this.lifecycle = new ExtensionLifecycleService({
      diagnostics: this.options.diagnostics,
      onProcessExit: this.handleProcessExit,
    });
    this.authLeases = new ExtensionAuthLeaseService({
      lifecycle: this.lifecycle,
      findManifest: this.findManifest,
      getEndpoint: () => this.endpoint,
      hasPersistentLease: (extensionId, channelId) =>
        this.persistentLeases.has(
          this.persistentLeaseKey(extensionId, channelId),
        ),
    });
    this.desktopRuntime = new ExtensionDesktopRuntimeService({
      authenticate: this.assertAuthorized,
      capabilityGrantManager: options.capabilityGrantManager,
      host: options.desktopHost,
      emitEvent: options.eventBus.emitEnvelope,
      findManifest: this.findManifest,
      hasAgent: options.hasAgent,
      onAuthorizationRequired: ({ applicationId, caller, request }) => {
        options.eventBus.emitEnvelope({
          type: "desktop.authorization.required",
          payload: { applicationId, caller, request },
          emittedAt: new Date().toISOString(),
          source: "backend",
        });
      },
      getCurrentGeneration: this.lifecycle.getCurrentGeneration,
      onObservationAuthorizationRevoked:
        options.onDesktopObservationAuthorizationRevoked,
      onObservationAuthorizationGranted:
        options.onDesktopObservationAuthorizationGranted,
      onObservationRuntimeExited: options.onObservationRuntimeExited,
    });
    this.observations = new ExtensionObservationRuntimeService({
      lifecycle: this.lifecycle,
      getEndpoint: () => this.endpoint,
      getManifests: () => this.manifests,
      findManifest: this.findManifest,
      request: this.requestExtension,
      onEvent: options.onObservationEvent,
    });
  }

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
      ingressKeys.extension.diagnosticEmit,
      this.handleDiagnosticEmit,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.channelCommandList,
      this.handleChannelCommandList,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.channelCommandExecute,
      this.handleChannelCommandExecute,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.runtimeReady,
      this.handleRuntimeReady,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.response,
      this.handleExtensionResponse,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.observationEvent,
      this.handleObservationEvent,
    );
    this.options.ingress.addHandler(
      ingressKeys.extension.desktopHostInvoke,
      this.desktopRuntime.handleInvoke,
    );
  };

  readonly loadChannelContributions = async (params: {
    config: Config;
    workspace: string;
  }): Promise<ExtensionRuntimeContributions> => {
    this.manifests = await this.manifestDiscovery.discover(
      resolveExtensionManifestRoots(params),
    );
    if (this.endpoint) {
      await this.reconcilePersistentDemand(params.config);
    }
    return this.contributions.toContributions(this.manifests);
  };

  readonly start = async (params: {
    endpoint: string | null;
  }): Promise<void> => {
    const endpoint = params.endpoint?.trim();
    if (!endpoint) {
      return;
    }
    this.endpoint = endpoint;
    const config = this.options.getConfig();
    if (this.manifests.length === 0) {
      this.manifests = await this.manifestDiscovery.discover(
        resolveExtensionManifestRoots({
          config,
          workspace: this.options.getWorkspace(),
        }),
      );
    }
    await this.reconcilePersistentDemand(config);
  };

  authenticateEventStreamCredential = (input: {
    extensionId: string | null;
    generation: string | null;
    token: string | null;
  }): { extensionId: string; generation: string } | null =>
    this.lifecycle.authenticateCredential(input);

  getStatus = () => this.lifecycle.getStatus();
  getManifests = () => this.manifests;
  get desktopHost(): DesktopHostCapabilityManager { return this.desktopRuntime.capabilities; }

  readonly stop = async (): Promise<void> => {
    this.endpoint = null;
    this.releaseTrackedLeases();
    this.observations.stop();
    this.authLeases.releaseAll();
    for (const [requestId, request] of this.pendingRequests) {
      request.cleanup();
      request.reject(new Error(`Extension request cancelled: ${requestId}`));
    }
    this.pendingRequests.clear();
    await this.lifecycle.stopAll();
    await this.desktopRuntime.stop();
  };

  readonly dispose = async (): Promise<void> => {
    await this.stop();
    await this.desktopRuntime.dispose();
  };

  private readonly reconcilePersistentDemand = async (
    config: Config,
  ): Promise<void> => {
    const endpoint = this.endpoint;
    if (!endpoint) {
      return;
    }
    const desired = new Map<
      string,
      { manifest: ExtensionManifest; channelId: string }
    >();
    const channelConfig = readRecord(config.channels);
    for (const manifest of this.manifests) {
      for (const channel of manifest.contributes?.channels ?? []) {
        const channelId = readString(channel.id);
        if (
          !channelId ||
          readRecord(channelConfig[channelId]).enabled !== true
        ) {
          continue;
        }
        desired.set(this.persistentLeaseKey(manifest.id, channelId), {
          manifest,
          channelId,
        });
      }
    }

    for (const [key, demand] of desired) {
      if (this.persistentLeases.has(key)) {
        this.authLeases.releaseHandoff(demand.manifest.id, demand.channelId);
        continue;
      }
      try {
        const lease = await this.lifecycle.acquire(demand.manifest, {
          endpoint,
          reason: { kind: "enabled-channel", channelId: demand.channelId },
        });
        this.persistentLeases.set(key, lease);
        this.authLeases.releaseHandoff(demand.manifest.id, demand.channelId);
      } catch (error) {
        console.warn(
          `Extension ${demand.manifest.id} failed to satisfy enabled channel ${demand.channelId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    for (const [key, lease] of this.persistentLeases) {
      if (desired.has(key)) {
        continue;
      }
      this.persistentLeases.delete(key);
      lease.release();
    }
  };

  private readonly releaseTrackedLeases = (): void => {
    for (const lease of this.persistentLeases.values()) {
      lease.release();
    }
    this.persistentLeases.clear();
  };

  private readonly persistentLeaseKey = (
    extensionId: string,
    channelId: string,
  ): string => `${extensionId}:${channelId}`;

  private readonly findManifest = (extensionId: string): ExtensionManifest => {
    const manifest = this.manifests.find((entry) => entry.id === extensionId);
    if (!manifest) {
      throw new Error(`Extension not found: ${extensionId}`);
    }
    return manifest;
  };

  private readonly handleChannelConfigGet = (
    envelope: IngressEnvelope<ExtensionChannelConfigGetIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(envelope, context);
    const payload = readRecord(envelope.payload);
    const channelId = readRequiredString(payload.channelId, "channelId");
    return {
      config:
        (this.options.getConfig().channels as Record<string, unknown>)[
          channelId
        ] ?? {},
    };
  };

  private readonly handleChannelMessageSubmit = async (
    envelope: IngressEnvelope<ExtensionChannelMessageSubmitIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(envelope, context);
    const message = toInboundMessage(envelope.payload);
    await this.options.messageBus.publishInbound(message);
    this.ingressDiagnostics.recordChannelMessageAccepted(message);
    return { accepted: true };
  };

  private readonly handleDiagnosticEmit = (
    envelope: IngressEnvelope<ExtensionDiagnosticIngressPayload>,
    context: IngressContext,
  ) => {
    const credential = this.assertAuthorized(envelope, context);
    this.ingressDiagnostics.recordExtensionEvent(envelope.payload, credential);
    return { accepted: true };
  };

  private readonly handleChannelCommandList = (
    envelope: IngressEnvelope<ExtensionChannelCommandListIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(envelope, context);
    const registry = new CommandRegistry(
      this.options.getConfig(),
      this.options.sessionManager,
    );
    return {
      commands: registry.listSlashCommands(),
    };
  };

  private readonly handleChannelCommandExecute = async (
    envelope: IngressEnvelope<ExtensionChannelCommandExecuteIngressPayload>,
    context: IngressContext,
  ) => {
    this.assertAuthorized(envelope, context);
    const payload = readRecord(envelope.payload);
    const channel = readRequiredString(payload.channelId, "channelId");
    const chatId = readRequiredString(payload.conversationId, "conversationId");
    const senderId = readRequiredString(payload.senderId, "senderId");
    const metadata = readRecord(payload.metadata);
    const config = this.options.getConfig();
    const registry = new CommandRegistry(config, this.options.sessionManager);
    const route = new AgentRouteResolver(config).resolveInbound({
      message: {
        channel,
        chatId,
        senderId,
        content:
          readString(payload.rawText) ?? readString(payload.commandName) ?? "",
        timestamp: new Date(),
        attachments: [],
        metadata,
      },
      forcedAgentId: readString(metadata.target_agent_id),
      sessionKeyOverride: readString(metadata.session_key_override),
    });
    const rawText = readString(payload.rawText);
    if (rawText) {
      const result = await registry.executeText(rawText, {
        channel,
        chatId,
        senderId,
        sessionKey: route.sessionKey,
      });
      return (
        result ?? {
          content: "",
          ephemeral: true,
        }
      );
    }
    return await registry.execute(
      readRequiredString(payload.commandName, "commandName"),
      readRecord(payload.args),
      {
        channel,
        chatId,
        senderId,
        sessionKey: route.sessionKey,
      },
    );
  };

  private readonly handleObservationEvent = async (
    envelope: IngressEnvelope<unknown>,
    context: IngressContext,
  ) => {
    const credential = this.assertAuthorized(envelope, context);
    return await this.observations.handleEvent({
      extensionId: credential.extensionId,
      payload: envelope.payload,
    });
  };

  private readonly handleExtensionResponse = (
    envelope: IngressEnvelope<ExtensionResponseIngressPayload>,
    context: IngressContext,
  ) => {
    const credential = this.assertAuthorized(envelope, context);
    const payload = readRecord(envelope.payload);
    const requestId = readRequiredString(payload.requestId, "requestId");
    const pending = this.pendingRequests.get(requestId);
    if (
      !pending ||
      pending.extensionId !== credential.extensionId ||
      pending.generation !== credential.generation
    ) {
      return { accepted: false };
    }
    this.pendingRequests.delete(requestId);
    pending.cleanup();
    if (payload.ok === false) {
      const error = readRecord(payload.error);
      const message = readString(error.message) ?? "Extension request failed";
      pending.reject(new Error(message));
      return { accepted: true };
    }
    pending.resolve(payload.data);
    return { accepted: true };
  };

  private readonly handleRuntimeReady = async (
    envelope: IngressEnvelope<ExtensionRuntimeReadyIngressPayload>,
    context: IngressContext,
  ) => {
    const credential = this.assertAuthorized(envelope, context);
    const payload = readRecord(envelope.payload);
    const generation = readRequiredString(payload.generation, "generation");
    const pid = readOptionalNumber(payload.pid);
    if (
      generation !== credential.generation ||
      pid === undefined ||
      !Number.isInteger(pid) ||
      pid <= 0
    ) {
      throw new Error("Invalid extension runtime ready payload");
    }
    this.lifecycle.markReady({
      extensionId: credential.extensionId,
      generation,
      pid,
    });
    void this.options
      .onObservationRuntimeReady?.(credential.extensionId)
      .catch((error) => {
        console.error(
          `[observation] failed to restore subscriptions for ${credential.extensionId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    return { accepted: true };
  };


  private readonly requestExtension = async <T>(params: {
    extensionId: string;
    kind: ExtensionChannelRequestKind | ExtensionObservationRequestKind;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<T> => {
    const { extensionId, kind, payload, signal } = params;
    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new Error("Extension request aborted");
    }
    const endpoint = this.endpoint;
    if (!endpoint) {
      throw new Error("Extension runtime is not started");
    }
    if (kind === "channel.outbound.sendText") {
      const channelId = readRequiredString(payload.channelId, "channelId");
      if (!this.isChannelEnabled(channelId)) {
        throw new Error(`Channel is disabled: ${channelId}`);
      }
    }
    const manifest = this.findManifest(extensionId);
    const requestId = randomUUID();
    const authSession =
      kind === "channel.auth.poll"
        ? this.authLeases.requireSession(
            extensionId,
            readRequiredString(payload.sessionId, "sessionId"),
          )
        : null;
    const requestLease = await this.lifecycle.acquire(manifest, {
      endpoint,
      ...(authSession ? { expectedGeneration: authSession.generation } : {}),
      reason: { kind: "request", requestId },
    });
    const result = new Promise<unknown>((resolvePromise, rejectPromise) => {
      const abort = (): void => {
        const pending = this.pendingRequests.get(requestId);
        if (!pending) return;
        this.pendingRequests.delete(requestId);
        pending.cleanup();
        pending.reject(
          signal?.reason instanceof Error
            ? signal.reason
            : new Error("Extension request aborted"),
        );
      };
      const cleanup = (): void => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      };
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (!pending) return;
        this.pendingRequests.delete(requestId);
        pending.cleanup();
        pending.reject(new Error(`Extension request timed out: ${kind}`));
      }, EXTENSION_REQUEST_TIMEOUT_MS);
      timeout.unref?.();
      this.pendingRequests.set(requestId, {
        extensionId,
        generation: requestLease.generation,
        resolve: resolvePromise,
        reject: rejectPromise,
        timeout,
        cleanup,
      });
      signal?.addEventListener("abort", abort, { once: true });
    });
    try {
      this.options.eventBus.emitEnvelope({
        type: EXTENSION_REQUEST_EVENT_TYPE,
        payload: {
          requestId,
          extensionId,
          generation: requestLease.generation,
          kind,
          payload,
        },
        emittedAt: new Date().toISOString(),
        source: "backend",
      });
      const value = await result;
      if (kind.startsWith("channel.")) {
        await this.authLeases.updateAfterRequest(
          params as Parameters<
            ExtensionAuthLeaseService["updateAfterRequest"]
          >[0],
          value,
          requestLease.generation,
        );
      }
      return value as T;
    } finally {
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        this.pendingRequests.delete(requestId);
        pending.cleanup();
      }
      requestLease.release();
    }
  };

  private readonly isChannelEnabled = (channelId: string): boolean =>
    readRecord(readRecord(this.options.getConfig().channels)[channelId])
      .enabled === true;

  private readonly handleProcessExit = async (
    event: ExtensionProcessExitEvent,
  ): Promise<void> => {
    for (const [requestId, pending] of this.pendingRequests) {
      if (
        pending.extensionId !== event.extensionId ||
        pending.generation !== event.generation
      ) {
        continue;
      }
      this.pendingRequests.delete(requestId);
      pending.cleanup();
      pending.reject(
        new Error(
          `Extension ${event.extensionId} exited during request ${requestId}.`,
        ),
      );
    }
    this.authLeases.handleProcessExit(event);
    await this.desktopRuntime.releaseProcessResources(event);
  };

  private readonly assertAuthorized = (
    envelope: IngressEnvelope<unknown>,
    context: IngressContext,
  ): { extensionId: string; generation: string } => {
    const credential = this.lifecycle.authenticateCredential({
      extensionId: readString(envelope.extensionId) ?? null,
      generation: readString(envelope.generation) ?? null,
      token: readString(context.token) ?? null,
    });
    if (!credential) {
      throw new Error("Unauthorized ingress token");
    }
    return credential;
  };
}
