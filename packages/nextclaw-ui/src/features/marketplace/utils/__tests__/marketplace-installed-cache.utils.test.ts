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
} from '../marketplace-installed-cache.utils';

describe('marketplace-installed-cache', () => {
  it('adds an MCP record immediately after install success', () => {
    const request: MarketplaceInstallRequest = {
      type: 'mcp',
      spec: 'filesystem',
      kind: 'template',
      name: 'filesystem'
    };
    const result: MarketplaceInstallResult = {
      type: 'mcp',
      spec: 'filesystem',
      name: 'filesystem',
      message: 'installed'
    };

    const next = applyInstallResultToInstalledView({ request, result });

    expect(next.total).toBe(1);
    expect(next.specs).toEqual(['filesystem']);
    expect(next.records[0]).toMatchObject({
      type: 'mcp',
      spec: 'filesystem',
      enabled: true,
      origin: 'marketplace',
      runtimeStatus: 'ready'
    });
  });

  it('marks an MCP record as disabled immediately after disable success', () => {
    const view: MarketplaceInstalledView = {
      type: 'mcp',
      total: 1,
      specs: ['filesystem'],
      records: [
        {
          type: 'mcp',
          id: 'filesystem',
          spec: 'filesystem',
          label: 'Filesystem',
          enabled: true,
          origin: 'marketplace'
        }
      ]
    };
    const request: MarketplaceManageRequest = {
      type: 'mcp',
      action: 'disable',
      id: 'filesystem',
      spec: 'filesystem'
    };
    const result: MarketplaceManageResult = {
      type: 'mcp',
      action: 'disable',
      id: 'filesystem',
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
