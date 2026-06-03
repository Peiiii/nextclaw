import { randomUUID } from "node:crypto";
import {
  PANEL_APP_AGENT_CAPABILITIES,
  PanelAppError,
  isPanelAppAgentCapability,
  type PanelAppAgentCapability,
  type PanelAppAgentGenerateObjectInput,
  type PanelAppAgentGenerateObjectResult,
  type PanelAppAgentRunClient,
  type PanelAppAgentSendPayload,
  type PanelAppAgentSendResult,
  type PanelAppCapabilityGrant,
} from "@kernel/types/panel-app.types.js";
import type { ServiceActionCaller } from "@kernel/types/service-app.types.js";
import type { PanelAppCapabilityGrantStore } from "@kernel/stores/panel-app-capability-grant.store.js";
import {
  createPanelAppAgentMetadata,
  createPanelAppGenerateObjectMessage,
  normalizePanelAppGenerateObjectInput,
  waitForPanelAppStructuredResult,
  withPanelAppAgentMetadata,
} from "@kernel/utils/panel-app-agent.utils.js";

type PanelAppAgentBridgeSession = {
  appId: string;
  caller: ServiceActionCaller;
  declaredCapabilities: string[];
};

export class PanelAppAgentBridgeService {
  constructor(private readonly params: {
    agentRunClient: PanelAppAgentRunClient | null;
    createCapabilityGrantStore: () => PanelAppCapabilityGrantStore;
  }) {}

  sendAgentMessage = async (
    bridgeSession: PanelAppAgentBridgeSession,
    payload: PanelAppAgentSendPayload,
  ): Promise<PanelAppAgentSendResult> => {
    await this.assertAgentCapabilityGranted(bridgeSession, "agent:send");
    return await this.requireAgentRunClient().send(
      withPanelAppAgentMetadata(payload, bridgeSession),
    );
  };

  generateAgentObject = async (
    bridgeSession: PanelAppAgentBridgeSession,
    input: PanelAppAgentGenerateObjectInput,
  ): Promise<PanelAppAgentGenerateObjectResult> => {
    await this.assertAgentCapabilityGranted(bridgeSession, "agent:generateObject");
    const request = normalizePanelAppGenerateObjectInput(input);
    const requestId = randomUUID();
    const message = createPanelAppGenerateObjectMessage({
      bridgeSession,
      request,
      requestId,
    });
    const result = await waitForPanelAppStructuredResult(this.requireAgentRunClient(), {
      payload: {
        message,
        metadata: {
          ...createPanelAppAgentMetadata(bridgeSession),
          panel_app_peer_id: request.peerId,
        },
        peerId: request.peerId,
      },
      timeoutMs: request.timeoutMs,
    });
    return { result };
  };

  grantAgentCapability = async (
    bridgeSession: PanelAppAgentBridgeSession,
    capability: PanelAppAgentCapability,
  ): Promise<PanelAppCapabilityGrant> => {
    if (!isPanelAppAgentCapability(capability)) {
      throw new PanelAppError(
        "PANEL_APP_AGENT_REQUEST_INVALID",
        "unknown panel app agent capability",
      );
    }
    this.assertDeclaredCapability(bridgeSession, capability);
    return await this.params.createCapabilityGrantStore().grant({
      caller: bridgeSession.caller,
      capability,
      grantedAt: new Date().toISOString(),
    });
  };

  private assertAgentCapabilityGranted = async (
    bridgeSession: PanelAppAgentBridgeSession,
    capability: PanelAppAgentCapability,
  ): Promise<void> => {
    this.assertDeclaredCapability(bridgeSession, capability);
    const granted = await this.params.createCapabilityGrantStore().isGranted(
      bridgeSession.caller,
      capability,
    );
    if (!granted) {
      throw new PanelAppError(
        "AUTHORIZATION_REQUIRED",
        `This panel app needs permission to use ${capability}.`,
      );
    }
  };

  private assertDeclaredCapability = (
    bridgeSession: PanelAppAgentBridgeSession,
    capability: PanelAppAgentCapability,
  ): void => {
    if (!bridgeSession.declaredCapabilities.includes(capability)) {
      throw new PanelAppError(
        "PANEL_APP_CAPABILITY_NOT_DECLARED",
        this.describeMissingAgentCapability(bridgeSession.declaredCapabilities, capability),
      );
    }
  };

  private describeMissingAgentCapability = (
    declaredCapabilities: string[],
    capability: PanelAppAgentCapability,
  ): string => {
    const declared = declaredCapabilities.length > 0
      ? declaredCapabilities.join(", ")
      : "none";
    const valid = PANEL_APP_AGENT_CAPABILITIES.join(", ");
    const hint = declaredCapabilities.includes(capability.replace(":", "."))
      ? ` Use ${capability}, not ${capability.replace(":", ".")}.`
      : "";
    return [
      `panel app did not declare ${capability}.`,
      `Declared: ${declared}.`,
      `Valid capabilities: ${valid}.`,
      `Declare it with nextclaw-panel-capabilities or panel-app.json capabilities.`,
      hint.trim(),
    ].filter(Boolean).join(" ");
  };

  private requireAgentRunClient = (): PanelAppAgentRunClient => {
    if (!this.params.agentRunClient) {
      throw new PanelAppError(
        "PANEL_APP_AGENT_REQUEST_INVALID",
        "panel app agent client is not configured",
      );
    }
    return this.params.agentRunClient;
  };
}
