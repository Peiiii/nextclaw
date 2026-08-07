import { describe, expect, it } from 'vitest';
import {
  buildNcpChatDiscoveredModelOptions,
  filterNcpChatDiscoveredModelOptionsBySessionType,
} from '@/features/chat/features/ncp/utils/ncp-chat-query-derived.utils';

const providersView = {
  providers: {
    opencode: {
      providerId: 'opencode',
      providerType: 'opencode',
      isBuiltInType: true,
      isCustom: false,
      enabled: true,
      displayName: 'OpenCode Zen Free Trial',
      apiKeyRequired: false,
      apiKeySet: false,
      models: ['big-pickle'],
    },
  },
};

const templatesView = {
  providerTemplates: [{
    id: 'opencode',
    providerType: 'opencode',
    displayName: 'OpenCode Zen Free Trial',
    modelPrefix: 'opencode',
    keywords: [],
    envKey: 'OPENCODE_API_KEY',
    apiKeyRequired: false,
  }],
};

const catalogView = {
  refreshIntervalMs: 43_200_000,
  refreshing: false,
  lastRefreshStartedAt: '2026-08-07T00:00:00.000Z',
  lastRefreshCompletedAt: '2026-08-07T00:00:01.000Z',
  providers: {
    opencode: {
      providerId: 'opencode',
      models: ['big-pickle', 'opencode/deepseek-v4-flash-free', 'mimo-v2.5-free'],
      source: 'catalog' as const,
      fetchedAt: '2026-08-07T00:00:00.500Z',
      lastError: null,
    },
  },
};

describe('provider model catalog derivation', () => {
  it('keeps remote order and returns only configured-provider models that are not already enabled', () => {
    const result = buildNcpChatDiscoveredModelOptions({
      catalogView,
      config: null,
      providersView,
      templatesView,
    });

    expect(result).toEqual([
      expect.objectContaining({
        value: 'opencode/deepseek-v4-flash-free',
        providerId: 'opencode',
        providerModel: 'deepseek-v4-flash-free',
      }),
      expect.objectContaining({
        value: 'opencode/mimo-v2.5-free',
        providerId: 'opencode',
        providerModel: 'mimo-v2.5-free',
      }),
    ]);
  });

  it('does not suggest models for providers that still require configuration', () => {
    const result = buildNcpChatDiscoveredModelOptions({
      catalogView,
      config: null,
      providersView: {
        providers: {
          opencode: {
            ...providersView.providers.opencode,
            apiKeyRequired: true,
          },
        },
      },
      templatesView,
    });

    expect(result).toEqual([]);
  });

  it('respects runtime-owned and explicitly restricted session model contracts', () => {
    const options = buildNcpChatDiscoveredModelOptions({
      catalogView,
      config: null,
      providersView,
      templatesView,
    });

    expect(filterNcpChatDiscoveredModelOptionsBySessionType({
      modelOptions: options,
      modelSelectionMode: 'runtime-default',
    })).toEqual([]);
    expect(filterNcpChatDiscoveredModelOptionsBySessionType({
      modelOptions: options,
      modelSelectionMode: 'nextclaw',
      supportedModels: ['opencode/mimo-v2.5-free'],
    }).map((option) => option.value)).toEqual(['opencode/mimo-v2.5-free']);
  });
});
