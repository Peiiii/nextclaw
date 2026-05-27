import { NextClawClientError } from '@nextclaw/client-sdk';
import type {
  PanelAppBridgeSessionView,
  ServiceActionGrantView,
  ServiceActionInvokeResultView,
  ServiceActionListView,
} from '@nextclaw/client-sdk';
import type { DocBrowserIframeMessageParams } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import { nextclawClient } from '@/shared/lib/api';

type PanelAppBridgeRequest = {
  type: 'nextclaw:panel-app-service-actions:request';
  requestId: string;
  method: 'invoke' | 'list' | 'requestGrant' | 'revokeGrant';
  payload?: {
    actionId?: string;
    input?: Record<string, unknown>;
  };
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
  private readonly sessions = new Map<string, Promise<PanelAppBridgeSessionView>>();

  handleIframeMessage = ({
    event,
    iframe,
    tab,
  }: DocBrowserIframeMessageParams): void => {
    if (!this.isBridgeRequest(event.data)) {
      return;
    }
    if (!iframe?.contentWindow || event.source !== iframe.contentWindow) {
      return;
    }
    void this.handleBridgeRequest({ event, iframe, tab }, event.data);
  };

  private handleBridgeRequest = async (
    params: DocBrowserIframeMessageParams,
    request: PanelAppBridgeRequest,
  ): Promise<void> => {
    try {
      const session = await this.getSession(params);
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
    session: PanelAppBridgeSessionView,
    request: PanelAppBridgeRequest,
  ): Promise<
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
      default:
        throw new Error(`Unsupported panel bridge method: ${String(request.method)}`);
    }
  };

  private invokeWithAuthorization = async (
    session: PanelAppBridgeSessionView,
    request: PanelAppBridgeRequest,
  ): Promise<ServiceActionInvokeResultView> => {
    const actionId = this.requireActionId(request);
    try {
      return await nextclawClient.serviceApps.invokeServiceAction(
        actionId,
        request.payload?.input,
        { bridgeSessionToken: session.token },
      );
    } catch (error) {
      if (!(error instanceof NextClawClientError) || error.code !== 'AUTHORIZATION_REQUIRED') {
        throw error;
      }
      await this.confirmAndGrant(session, actionId);
      return await nextclawClient.serviceApps.invokeServiceAction(
        actionId,
        request.payload?.input,
        { bridgeSessionToken: session.token },
      );
    }
  };

  private confirmAndGrant = async (
    session: PanelAppBridgeSessionView,
    actionId: string,
  ): Promise<ServiceActionGrantView> => {
    if (!window.confirm(`Allow this Panel App to call ${actionId}?`)) {
      throw new NextClawClientError({
        code: 'AUTHORIZATION_REJECTED',
        message: `Permission rejected for ${actionId}.`,
      });
    }
    return await nextclawClient.serviceApps.grantServiceAction(
      actionId,
      { bridgeSessionToken: session.token },
    );
  };

  private getSession = async (
    params: DocBrowserIframeMessageParams,
  ): Promise<PanelAppBridgeSessionView> => {
    const panelAppId = this.readPanelAppId(params.tab.currentUrl);
    const key = `${params.tab.id}:${panelAppId}`;
    let session = this.sessions.get(key);
    if (!session) {
      session = nextclawClient.panelApps.createBridgeSession({
        panelAppId,
        tabId: params.tab.id,
      });
      this.sessions.set(key, session);
    }
    return await session;
  };

  private readPanelAppId = (url: string): string => {
    const parsed = new URL(url, window.location.origin);
    const match = /^\/api\/panel-apps\/([^/]+)\/content$/.exec(parsed.pathname);
    if (!match?.[1]) {
      throw new Error('Current tab is not a Panel App.');
    }
    return decodeURIComponent(match[1]);
  };

  private requireActionId = (request: PanelAppBridgeRequest): string => {
    const actionId = request.payload?.actionId?.trim();
    if (!actionId) {
      throw new Error('Panel bridge actionId is required.');
    }
    return actionId;
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
      (candidate.method === 'invoke' ||
        candidate.method === 'list' ||
        candidate.method === 'requestGrant' ||
        candidate.method === 'revokeGrant')
    );
  };
}

export const panelAppBridgeManager = new PanelAppBridgeManager();
