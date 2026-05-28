import { NextClawClientError } from '@nextclaw/client-sdk';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelAppBridgeManager } from '@/features/panel-apps/managers/panel-app-bridge.manager';
import type { ServiceActionAuthorizationManager } from '@/features/service-apps';

const mocks = vi.hoisted(() => ({
  createBridgeSession: vi.fn(),
  generateAgentObject: vi.fn(),
  grantAgentCapability: vi.fn(),
  grantServiceAction: vi.fn(),
  invokeServiceAction: vi.fn(),
  listServiceActions: vi.fn(),
  sendAgentMessage: vi.fn(),
  requestAuthorization: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  nextclawClient: {
    panelApps: {
      createBridgeSession: mocks.createBridgeSession,
      generateAgentObject: mocks.generateAgentObject,
      grantAgentCapability: mocks.grantAgentCapability,
      sendAgentMessage: mocks.sendAgentMessage,
    },
    serviceApps: {
      grantServiceAction: mocks.grantServiceAction,
      invokeServiceAction: mocks.invokeServiceAction,
      listServiceActions: mocks.listServiceActions,
      revokeServiceAction: vi.fn(),
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('PanelAppBridgeManager', () => {
  it('opens the authorization flow before retrying a protected service action', async () => {
    const manager = new PanelAppBridgeManager({
      requestAuthorization: mocks.requestAuthorization,
    } as unknown as ServiceActionAuthorizationManager);
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    const iframe = { contentWindow } as HTMLIFrameElement;
    const actionId = 'mood-tracker.saveMood';
    mocks.createBridgeSession.mockResolvedValue({
      expiresAt: '2026-05-28T00:00:00.000Z',
      id: 'session-1',
      panelAppId: 'mood-calendar',
      tabId: 'tab-1',
      token: 'token-1',
    });
    mocks.invokeServiceAction
      .mockRejectedValueOnce(new NextClawClientError({
        code: 'AUTHORIZATION_REQUIRED',
        message: 'authorization required',
      }))
      .mockResolvedValueOnce({ actionId, result: { saved: true } });
    mocks.listServiceActions.mockResolvedValue({
      actions: [{
        appId: 'mood-tracker',
        description: 'Save daily mood entries',
        id: actionId,
        name: 'saveMood',
        risk: 'write',
        title: 'Save mood',
      }],
    });
    mocks.requestAuthorization.mockResolvedValue(true);
    mocks.grantServiceAction.mockResolvedValue({
      actionId,
      caller: { surface: 'panel-app', appId: 'mood-calendar' },
      grantedAt: '2026-05-28T00:00:00.000Z',
      risk: 'write',
    });

    manager.handleIframeMessage({
      event: {
        data: {
          method: 'invoke',
          payload: { actionId, input: { mood: 'happy' } },
          requestId: 'request-1',
          type: 'nextclaw:panel-app-service-actions:request',
        },
        source: contentWindow,
      } as MessageEvent,
      iframe,
      iframeInstanceId: 'tab-1:0:0',
      tab: {
        currentUrl: '/api/panel-apps/mood-calendar/content',
        history: [],
        historyIndex: 0,
        id: 'tab-1',
        kind: 'content',
        navVersion: 0,
        title: 'Mood Calendar',
      },
    });

    await waitFor(() => expect(postMessage).toHaveBeenCalled());

    expect(mocks.requestAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      actionId,
      actionTitle: 'Save mood',
      inputPreview: expect.stringContaining('happy'),
      panelAppId: 'mood-calendar',
      risk: 'write',
    }));
    expect(mocks.grantServiceAction).toHaveBeenCalledWith(actionId, {
      bridgeSessionToken: 'token-1',
    });
    expect(mocks.invokeServiceAction).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledWith({
      data: { actionId, result: { saved: true } },
      ok: true,
      requestId: 'request-1',
      type: 'nextclaw:panel-app-service-actions:response',
    }, '*');
  });

  it('opens the authorization flow before retrying a protected generateObject call', async () => {
    const manager = new PanelAppBridgeManager({
      requestAuthorization: mocks.requestAuthorization,
    } as unknown as ServiceActionAuthorizationManager);
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    const iframe = { contentWindow } as HTMLIFrameElement;
    mocks.createBridgeSession.mockResolvedValue({
      expiresAt: '2026-05-28T00:00:00.000Z',
      id: 'session-1',
      panelAppId: 'mood-calendar',
      tabId: 'tab-1',
      token: 'token-1',
    });
    mocks.generateAgentObject
      .mockRejectedValueOnce(new NextClawClientError({
        code: 'AUTHORIZATION_REQUIRED',
        message: 'authorization required',
      }))
      .mockResolvedValueOnce({ result: { summary: 'sunny' } });
    mocks.requestAuthorization.mockResolvedValue(true);
    mocks.grantAgentCapability.mockResolvedValue({
      caller: { surface: 'panel-app', appId: 'mood-calendar' },
      capability: 'agent:generateObject',
      grantedAt: '2026-05-28T00:00:00.000Z',
    });

    manager.handleIframeMessage({
      event: {
        data: {
          method: 'agent.generateObject',
          payload: {
            input: {
              peerId: 'mood-summary',
              prompt: 'summarize',
              schema: { type: 'object' },
            },
          },
          requestId: 'request-2',
          type: 'nextclaw:panel-app-service-actions:request',
        },
        source: contentWindow,
      } as MessageEvent,
      iframe,
      iframeInstanceId: 'tab-1:0:0',
      tab: {
        currentUrl: '/api/panel-apps/mood-calendar/content',
        history: [],
        historyIndex: 0,
        id: 'tab-1',
        kind: 'content',
        navVersion: 0,
        title: 'Mood Calendar',
      },
    });

    await waitFor(() => expect(postMessage).toHaveBeenCalled());

    expect(mocks.requestAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'agent:generateObject',
      panelAppId: 'mood-calendar',
      risk: 'write',
    }));
    expect(mocks.grantAgentCapability).toHaveBeenCalledWith('agent:generateObject', {
      bridgeSessionToken: 'token-1',
    });
    expect(mocks.generateAgentObject).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledWith({
      data: { result: { summary: 'sunny' } },
      ok: true,
      requestId: 'request-2',
      type: 'nextclaw:panel-app-service-actions:response',
    }, '*');
  });

  it('creates a fresh bridge session for each iframe instance', async () => {
    const manager = new PanelAppBridgeManager({
      requestAuthorization: mocks.requestAuthorization,
    } as unknown as ServiceActionAuthorizationManager);
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    const iframe = { contentWindow } as HTMLIFrameElement;
    mocks.createBridgeSession
      .mockResolvedValueOnce({
        expiresAt: '2026-05-28T00:00:00.000Z',
        id: 'session-1',
        panelAppId: 'mood-calendar',
        tabId: 'tab-1',
        token: 'token-1',
      })
      .mockResolvedValueOnce({
        expiresAt: '2026-05-28T00:00:00.000Z',
        id: 'session-2',
        panelAppId: 'mood-calendar',
        tabId: 'tab-1',
        token: 'token-2',
      });
    mocks.listServiceActions.mockResolvedValue({ actions: [] });

    for (const [requestId, iframeInstanceId] of [
      ['request-1', 'tab-1:0:0'],
      ['request-2', 'tab-1:0:0'],
      ['request-3', 'tab-1:0:1'],
    ]) {
      manager.handleIframeMessage({
        event: {
          data: {
            method: 'list',
            requestId,
            type: 'nextclaw:panel-app-service-actions:request',
          },
          source: contentWindow,
        } as MessageEvent,
        iframe,
        iframeInstanceId,
        tab: {
          currentUrl: '/api/panel-apps/mood-calendar/content',
          history: [],
          historyIndex: 0,
          id: 'tab-1',
          kind: 'content',
          navVersion: 0,
          title: 'Mood Calendar',
        },
      });
    }

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(3));

    expect(mocks.createBridgeSession).toHaveBeenCalledTimes(2);
    expect(mocks.listServiceActions).toHaveBeenNthCalledWith(1, {
      bridgeSessionToken: 'token-1',
    });
    expect(mocks.listServiceActions).toHaveBeenNthCalledWith(2, {
      bridgeSessionToken: 'token-1',
    });
    expect(mocks.listServiceActions).toHaveBeenNthCalledWith(3, {
      bridgeSessionToken: 'token-2',
    });
  });
});
