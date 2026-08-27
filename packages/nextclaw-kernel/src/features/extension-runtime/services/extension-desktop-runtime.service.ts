import {
  type ExtensionDesktopHostInvokeIngressPayload,
  type IngressContext,
  type IngressEnvelope,
} from "@nextclaw/shared";
import {
  DesktopHostCapabilityManager,
  type DesktopHost,
} from "@kernel/features/desktop-host/index.js";
import type { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import type {
  ExtensionManifest,
  ExtensionProcessExitEvent,
} from "@kernel/features/extension-runtime/types/extension-runtime.types.js";
import {
  readRecord,
  readRequiredString,
  readString,
} from "@kernel/features/extension-runtime/utils/extension-runtime-payload.utils.js";

export class ExtensionDesktopRuntimeService {
  readonly capabilities: DesktopHostCapabilityManager;

  constructor(private readonly options: {
    authenticate: (
      envelope: IngressEnvelope<unknown>,
      context: IngressContext,
    ) => { extensionId: string; generation: string };
    capabilityGrantManager: CapabilityGrantManager;
    host: DesktopHost;
    emitEvent: (event: {
      type: string;
      payload: unknown;
      emittedAt: string;
      source: "backend";
    }) => void;
    findManifest: (extensionId: string) => ExtensionManifest;
    hasAgent?: (agentId: string) => boolean;
    onAuthorizationRequired?: ConstructorParameters<
      typeof DesktopHostCapabilityManager
    >[0]["onAuthorizationRequired"];
    getCurrentGeneration: (extensionId: string) => string | null;
    onObservationAuthorizationRevoked?: (input: {
      extensionId: string;
      subscriptionId: string;
    }) => Promise<void>;
    onObservationAuthorizationGranted?: (input: {
      extensionId: string;
    }) => Promise<void>;
    onObservationRuntimeExited?: (extensionId: string) => void;
  }) {
    this.capabilities = new DesktopHostCapabilityManager({
      capabilityGrantManager: options.capabilityGrantManager,
      host: options.host,
      findManifest: options.findManifest,
      hasAgent: options.hasAgent,
      onAuthorizationRequired: options.onAuthorizationRequired,
      onEvent: ({ extensionId, generation, watchId, event }) => {
        if (options.getCurrentGeneration(extensionId) !== generation) return;
        options.emitEvent({
          type: "extension.host.desktop.event",
          payload: { extensionId, generation, watchId, event },
          emittedAt: new Date().toISOString(),
          source: "backend",
        });
      },
      onObservationAuthorizationRevoked:
        options.onObservationAuthorizationRevoked,
      onObservationAuthorizationGranted:
        options.onObservationAuthorizationGranted,
    });
  }

  handleInvoke = async (
    envelope: IngressEnvelope<ExtensionDesktopHostInvokeIngressPayload>,
    context: IngressContext,
  ): Promise<unknown> => {
    const credential = this.options.authenticate(envelope, context);
    const payload = readRecord(envelope.payload);
    const caller = readRecord(payload.caller);
    return await this.capabilities.invoke({
      extensionId: credential.extensionId,
      generation: credential.generation,
      method: readRequiredString(payload.method, "method") as never,
      payload: readRecord(payload.payload),
      caller: {
        ...(readString(caller.sessionId)
          ? { sessionId: readString(caller.sessionId) }
          : {}),
        ...(readString(caller.agentRunId)
          ? { agentRunId: readString(caller.agentRunId) }
          : {}),
        ...(readString(caller.subscriptionId)
          ? { subscriptionId: readString(caller.subscriptionId) }
          : {}),
      },
    });
  };

  releaseProcessResources = async (
    event: ExtensionProcessExitEvent,
  ): Promise<void> => {
    await this.capabilities.releaseExtensionWatches(
      event.extensionId,
      event.generation,
    );
    this.options.onObservationRuntimeExited?.(event.extensionId);
  };

  stop = async (): Promise<void> => await this.capabilities.stop();

  dispose = async (): Promise<void> => await this.capabilities.dispose();
}
