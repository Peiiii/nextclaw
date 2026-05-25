import type {
  MarketplaceInstalledView,
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceManageRequest,
  MarketplaceManageResult
} from '@/shared/lib/api';
import {
  applyInstallResultToInstalledView,
  applyManageResultToInstalledView
} from './marketplace-installed-cache.utils';

describe('marketplace-installed-cache', () => {
  it('adds a plugin record immediately after install success', () => {
    const request: MarketplaceInstallRequest = {
      type: 'plugin',
      spec: '@nextclaw/community-plugin-slack',
      kind: 'npm'
    };
    const result: MarketplaceInstallResult = {
      type: 'plugin',
      spec: '@nextclaw/community-plugin-slack',
      message: 'installed'
    };

    const next = applyInstallResultToInstalledView({ request, result });

    expect(next.total).toBe(1);
    expect(next.specs).toEqual(['@nextclaw/community-plugin-slack']);
    expect(next.records[0]).toMatchObject({
      type: 'plugin',
      spec: '@nextclaw/community-plugin-slack',
      enabled: true,
      origin: 'marketplace',
      runtimeStatus: 'ready'
    });
  });

  it('marks a plugin record as disabled immediately after disable success', () => {
    const view: MarketplaceInstalledView = {
      type: 'plugin',
      total: 1,
      specs: ['@nextclaw/community-plugin-slack'],
      records: [
        {
          type: 'plugin',
          id: '@nextclaw/community-plugin-slack',
          spec: '@nextclaw/community-plugin-slack',
          label: 'Slack Channel',
          enabled: true,
          origin: 'marketplace'
        }
      ]
    };
    const request: MarketplaceManageRequest = {
      type: 'plugin',
      action: 'disable',
      id: '@nextclaw/community-plugin-slack',
      spec: '@nextclaw/community-plugin-slack'
    };
    const result: MarketplaceManageResult = {
      type: 'plugin',
      action: 'disable',
      id: '@nextclaw/community-plugin-slack',
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
