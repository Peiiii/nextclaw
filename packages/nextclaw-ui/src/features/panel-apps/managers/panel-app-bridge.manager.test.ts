import { NextClawClientError } from '@nextclaw/client-sdk';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PanelAppBridgeManager } from '@/features/panel-apps/managers/panel-app-bridge.manager';
import type { ServiceActionAuthorizationManager } from '@/features/service-apps';

const mocks = vi.hoisted(() => ({
  createBridgeSession: vi.fn(),
  grantServiceAction: vi.fn(),
  invokeServiceAction: vi.fn(),
  listServiceActions: vi.fn(),
  requestAuthorization: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  nextclawClient: {
    panelApps: {
      createBridgeSession: mocks.createBridgeSession,
    },
    serviceApps: {
      grantServiceAction: mocks.grantServiceAction,
      invokeServiceAction: mocks.invokeServiceAction,
      listServiceActions: mocks.listServiceActions,
      revokeServiceAction: vi.fn(),
    },
  },
}));

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
});
