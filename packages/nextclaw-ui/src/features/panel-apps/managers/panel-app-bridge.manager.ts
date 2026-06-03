import { NextClawClientError } from '@nextclaw/client-sdk';
import type {
  PanelAppAgentCapabilityView,
  PanelAppAgentGenerateObjectRequestView,
  PanelAppAgentGenerateObjectResultView,
  PanelAppAgentSendRequestView,
  PanelAppAgentSendResultView,
  PanelAppCapabilityGrantView,
  ServiceActionGrantView,
  ServiceActionInvokeResultView,
  ServiceActionListView,
} from '@nextclaw/client-sdk';
import type { ServiceActionAuthorizationManager } from '@/features/service-apps';
import type { DocBrowserIframeMessageParams } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import { nextclawClient } from '@/shared/lib/api';

type PanelAppBridgeRequest = {
  type: 'nextclaw:panel-app-service-actions:request';
  requestId: string;
  appId: string;
  runtimeToken: string;
  method:
    | 'agent.generateObject'
    | 'agent.send'
    | 'invoke'
    | 'list'
    | 'requestGrant'
    | 'revokeGrant';
  payload?: {
    actionId?: string;
    input?: unknown;
    request?: unknown;
  };
};

type PanelAppBridgeContext = {
  appId: string;
  token: string;
};

type PanelAppBridgeResponse =
  | {
      type: 'nextclaw:panel-app-service-actions:response';
      requestId: string;
      ok: true;
      data: unknown;
    }
  | {
      type: 'nextclaw:panel-app-service-actions:response';
      requestId: string;
      ok: false;
      error: {
        code?: string;
        message: string;
        details?: Record<string, unknown>;
      };
    };

export class PanelAppBridgeManager {
  constructor(private readonly authorizationManager: ServiceActionAuthorizationManager) {}

  handleIframeMessage = ({ event, iframe, iframeInstanceId, tab }: DocBrowserIframeMessageParams): void => {
    if (!this.isBridgeRequest(event.data)) {
      return;
    }
    if (!iframe?.contentWindow || event.source !== iframe.contentWindow) {
      return;
    }
    void this.handleBridgeRequest({ event, iframe, iframeInstanceId, tab }, event.data);
  };

  private handleBridgeRequest = async (
    params: DocBrowserIframeMessageParams,
    request: PanelAppBridgeRequest,
  ): Promise<void> => {
    try {
      const session = this.getBridgeContext(request);
      const data = await this.dispatchRequest(session, request);
      this.postResponse(params, {
        type: 'nextclaw:panel-app-service-actions:response',
        requestId: request.requestId,
        ok: true,
        data,
      });
    } catch (error) {
      this.postResponse(params, {
        type: 'nextclaw:panel-app-service-actions:response',
        requestId: request.requestId,
        ok: false,
        error: this.toBridgeError(error),
      });
    }
  };

  private dispatchRequest = async (
    session: PanelAppBridgeContext,
    request: PanelAppBridgeRequest,
  ): Promise<
    | PanelAppAgentGenerateObjectResultView
    | PanelAppAgentSendResultView
    | PanelAppCapabilityGrantView
    | ServiceActionGrantView
    | ServiceActionInvokeResultView
    | ServiceActionListView
    | { revoked: boolean }
  > => {
    switch (request.method) {
      case 'list':
        return await nextclawClient.serviceApps.listServiceActions({
          bridgeSessionToken: session.token,
        });
      case 'requestGrant':
        return await this.confirmAndGrant(session, this.requireActionId(request));
      case 'revokeGrant':
        return await nextclawClient.serviceApps.revokeServiceAction(
          this.requireActionId(request),
          { bridgeSessionToken: session.token },
        );
      case 'invoke':
        return await this.invokeWithAuthorization(session, request);
      case 'agent.send':
        return await this.sendAgentMessageWithAuthorization(session, request);
      case 'agent.generateObject':
        return await this.generateAgentObjectWithAuthorization(session, request);
      default:
        throw new Error(`Unsupported panel bridge method: ${String(request.method)}`);
    }
  };

  private invokeWithAuthorization = async (
    session: PanelAppBridgeContext,
    request: PanelAppBridgeRequest,
  ): Promise<ServiceActionInvokeResultView> => {
    const actionId = this.requireActionId(request);
    try {
      return await nextclawClient.serviceApps.invokeServiceAction(
        actionId,
        this.readOptionalRecord(request.payload?.input),
        { bridgeSessionToken: session.token },
      );
    } catch (error) {
      if (!(error instanceof NextClawClientError) || error.code !== 'AUTHORIZATION_REQUIRED') {
        throw error;
      }
      await this.confirmAndGrant(session, actionId, this.readOptionalRecord(request.payload?.input));
      return await nextclawClient.serviceApps.invokeServiceAction(
        actionId,
        this.readOptionalRecord(request.payload?.input),
        { bridgeSessionToken: session.token },
      );
    }
  };

  private sendAgentMessageWithAuthorization = async (
    session: PanelAppBridgeContext,
    request: PanelAppBridgeRequest,
  ): Promise<PanelAppAgentSendResultView> => {
    try {
      return await nextclawClient.panelApps.sendAgentMessage(
        this.readAgentSendRequest(request),
        { bridgeSessionToken: session.token },
      );
    } catch (error) {
      if (!(error instanceof NextClawClientError) || error.code !== 'AUTHORIZATION_REQUIRED') {
        throw error;
      }
      await this.confirmAndGrantAgentCapability(session, 'agent:send');
      return await nextclawClient.panelApps.sendAgentMessage(
        this.readAgentSendRequest(request),
        { bridgeSessionToken: session.token },
      );
    }
  };

  private generateAgentObjectWithAuthorization = async (
    session: PanelAppBridgeContext,
    request: PanelAppBridgeRequest,
  ): Promise<PanelAppAgentGenerateObjectResultView> => {
    try {
      return await nextclawClient.panelApps.generateAgentObject(
        this.readGenerateObjectRequest(request),
        { bridgeSessionToken: session.token },
      );
    } catch (error) {
      if (!(error instanceof NextClawClientError) || error.code !== 'AUTHORIZATION_REQUIRED') {
        throw error;
      }
      await this.confirmAndGrantAgentCapability(session, 'agent:generateObject');
      return await nextclawClient.panelApps.generateAgentObject(
        this.readGenerateObjectRequest(request),
        { bridgeSessionToken: session.token },
      );
    }
  };

  private confirmAndGrantAgentCapability = async (
    session: PanelAppBridgeContext,
    capability: PanelAppAgentCapabilityView,
  ): Promise<PanelAppCapabilityGrantView> => {
    const allowed = await this.authorizationManager.requestAuthorization({
      panelAppId: session.appId,
      actions: [{
        actionId: capability,
        actionTitle: capability === 'agent:send' ? 'Send agent message' : 'Generate object',
        actionDescription: capability === 'agent:send'
          ? 'Send a message to a NextClaw Agent session.'
          : 'Send context to a NextClaw Agent session and receive a structured object.',
        risk: 'write',
      }],
    });
    if (!allowed) {
      throw new NextClawClientError({
        code: 'AUTHORIZATION_REJECTED',
        message: `Permission rejected for ${capability}.`,
      });
    }
    return await nextclawClient.panelApps.grantAgentCapability(
      capability,
      { bridgeSessionToken: session.token },
    );
  };

  private confirmAndGrant = async (
    session: PanelAppBridgeContext,
    actionId: string,
    input?: Record<string, unknown>,
  ): Promise<ServiceActionGrantView> => {
    const actions = await this.listGrantCandidateActions(session, actionId);
    const allowed = await this.authorizationManager.requestAuthorization({
      panelAppId: session.appId,
      actions: actions.map((action) => ({
        actionId: action.id,
        actionTitle: action.title,
        actionDescription: action.description,
        risk: action.risk,
      })),
      inputPreview: this.createInputPreview(input),
    });
    if (!allowed) {
      throw new NextClawClientError({
        code: 'AUTHORIZATION_REJECTED',
        message: `Permission rejected for ${actionId}.`,
      });
    }
    const result = await nextclawClient.serviceApps.grantServiceActions(
      actions.map((action) => action.id),
      { bridgeSessionToken: session.token },
    );
    const grant = result.grants.find((entry) => entry.actionId === actionId) ?? result.grants[0];
    if (!grant) {
      throw new Error(`No permission grant returned for ${actionId}.`);
    }
    return grant;
  };

  private listGrantCandidateActions = async (
    session: PanelAppBridgeContext,
    actionId: string,
  ): Promise<Array<ServiceActionListView['actions'][number]>> => {
    const actionList = await nextclawClient.serviceApps.listServiceActions({
      bridgeSessionToken: session.token,
    });
    const target = actionList.actions.find(
      (action: ServiceActionListView['actions'][number]) => action.id === actionId,
    );
    if (target && target.grantState !== 'not-granted') {
      return [target];
    }
    const ungrantedActions = actionList.actions.filter((action) =>
      action.grantState === 'not-granted'
    );
    const orderedActions = [
      ...ungrantedActions.filter((action) => action.id === actionId),
      ...ungrantedActions.filter((action) => action.id !== actionId),
    ];
    if (orderedActions.length > 0) {
      return orderedActions;
    }
    return [{
      appId: target?.appId ?? actionId.split('.')[0] ?? actionId,
      description: target?.description,
      id: actionId,
      name: target?.name ?? actionId,
      risk: target?.risk ?? 'dangerous',
      title: target?.title,
    }];
  };

  private createInputPreview = (input: Record<string, unknown> | undefined): string | undefined => {
    if (!input || Object.keys(input).length === 0) {
      return undefined;
    }
    try {
      const value = JSON.stringify(input, null, 2);
      return value.length > 500 ? `${value.slice(0, 500)}...` : value;
    } catch {
      return '[unserializable input]';
    }
  };

  private getBridgeContext = (request: PanelAppBridgeRequest): PanelAppBridgeContext => {
    return {
      appId: request.appId,
      token: request.runtimeToken,
    };
  };

  private requireActionId = (request: PanelAppBridgeRequest): string => {
    const actionId = request.payload?.actionId?.trim();
    if (!actionId) {
      throw new Error('Panel bridge actionId is required.');
    }
    return actionId;
  };

  private readOptionalRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (value === undefined) {
      return undefined;
    }
    return this.requireRecord(value, 'input');
  };

  private readAgentSendRequest = (
    request: PanelAppBridgeRequest,
  ): PanelAppAgentSendRequestView => ({
    payload: this.requireRecord(request.payload?.request, 'agent.send request') as PanelAppAgentSendRequestView['payload'],
  });

  private readGenerateObjectRequest = (
    request: PanelAppBridgeRequest,
  ): PanelAppAgentGenerateObjectRequestView => ({
    input: this.requireRecord(request.payload?.input, 'generateObject input') as PanelAppAgentGenerateObjectRequestView['input'],
  });

  private requireRecord = (value: unknown, label: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label} is required.`);
    }
    return value as Record<string, unknown>;
  };

  private postResponse = (
    params: DocBrowserIframeMessageParams,
    response: PanelAppBridgeResponse,
  ): void => {
    params.iframe?.contentWindow?.postMessage(response, '*');
  };

  private toBridgeError = (
    error: unknown,
  ): { code?: string; message: string; details?: Record<string, unknown> } => {
    if (error instanceof NextClawClientError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
      };
    }
    return {
      message: error instanceof Error ? error.message : String(error),
    };
  };

  private isBridgeRequest = (value: unknown): value is PanelAppBridgeRequest => {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Partial<PanelAppBridgeRequest>;
    return (
      candidate.type === 'nextclaw:panel-app-service-actions:request' &&
      typeof candidate.requestId === 'string' &&
      typeof candidate.runtimeToken === 'string' &&
      typeof candidate.appId === 'string' &&
      (candidate.method === 'invoke' ||
        candidate.method === 'agent.send' ||
        candidate.method === 'agent.generateObject' ||
        candidate.method === 'list' ||
        candidate.method === 'requestGrant' ||
        candidate.method === 'revokeGrant')
    );
  };
}
