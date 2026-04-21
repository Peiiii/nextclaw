import type {
  MarketplaceInstalledView,
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceManageRequest,
  MarketplaceManageResult
} from '@/api/types';
import {
  applyInstallResultToInstalledView,
  applyManageResultToInstalledView
} from './marketplace-installed-cache.utils';

describe('marketplace-installed-cache', () => {
  it('adds a plugin record immediately after install success', () => {
    const request: MarketplaceInstallRequest = {
      type: 'plugin',
      spec: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk',
      kind: 'npm'
    };
    const result: MarketplaceInstallResult = {
      type: 'plugin',
      spec: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk',
      message: 'installed'
    };

    const next = applyInstallResultToInstalledView({ request, result });

    expect(next.total).toBe(1);
    expect(next.specs).toEqual(['@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk']);
    expect(next.records[0]).toMatchObject({
      type: 'plugin',
      spec: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk',
      enabled: true,
      origin: 'marketplace',
      runtimeStatus: 'ready'
    });
  });

  it('marks a plugin record as disabled immediately after disable success', () => {
    const view: MarketplaceInstalledView = {
      type: 'plugin',
      total: 1,
      specs: ['@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk'],
      records: [
        {
          type: 'plugin',
          id: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk',
          spec: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk',
          label: 'Codex Runtime',
          enabled: true,
          origin: 'marketplace'
        }
      ]
    };
    const request: MarketplaceManageRequest = {
      type: 'plugin',
      action: 'disable',
      id: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk',
      spec: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk'
    };
    const result: MarketplaceManageResult = {
      type: 'plugin',
      action: 'disable',
      id: '@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk',
      message: 'disabled'
    };

    const next = applyManageResultToInstalledView({ view, request, result });

    expect(next.records[0]).toMatchObject({
      enabled: false,
      runtimeStatus: 'disabled'
    });
  });

  it('removes a skill record immediately after uninstall success', () => {
    const view: MarketplaceInstalledView = {
      type: 'skill',
      total: 1,
      specs: ['@nextclaw/web-search'],
      records: [
        {
          type: 'skill',
          id: 'web-search',
          spec: '@nextclaw/web-search',
          label: 'Web Search',
          source: 'workspace'
        }
      ]
    };
    const request: MarketplaceManageRequest = {
      type: 'skill',
      action: 'uninstall',
      id: 'web-search',
      spec: '@nextclaw/web-search'
    };
    const result: MarketplaceManageResult = {
      type: 'skill',
      action: 'uninstall',
      id: 'web-search',
      message: 'removed'
    };

    const next = applyManageResultToInstalledView({ view, request, result });

    expect(next.total).toBe(0);
    expect(next.records).toEqual([]);
    expect(next.specs).toEqual([]);
  });
});
