import { describe, expect, it } from 'vitest';
import { RightPanelResourceRouteResolver } from '@/features/right-panel-resources';

describe('RightPanelResourceRouteResolver', () => {
  it('normalizes apps resources and keeps service apps distinct', () => {
    const resolver = new RightPanelResourceRouteResolver();

    expect(resolver.resolve('nextclaw://apps')).toMatchObject({
      dedupeKey: 'apps',
      kind: 'apps',
      resourceUri: 'nextclaw://apps',
      url: 'nextclaw://apps',
    });
    expect(resolver.resolve('nextclaw://apps?tab=service-apps')).toMatchObject({
      dedupeKey: 'apps',
      kind: 'apps',
      resourceUri: 'nextclaw://apps?tab=service-apps',
      url: 'nextclaw://apps?tab=service-apps',
    });
  });

  it('resolves nextclaw docs resources into docs targets', () => {
    const resolver = new RightPanelResourceRouteResolver();
    const target = resolver.resolve('nextclaw://docs/guide/getting-started');

    expect(target.kind).toBe('docs');
    expect(target.resourceUri).toBe('nextclaw://docs/guide/getting-started');
    expect(target.title).toBe('Help Docs');
    expect(target.url).toContain('/guide/getting-started');
  });

  it('resolves panel app resources to a stable target identity', () => {
    const resolver = new RightPanelResourceRouteResolver();

    expect(resolver.resolve('nextclaw://panel-app/timer')).toMatchObject({
      dedupeKey: 'panel-app:timer',
      kind: 'panel-app',
      resourceUri: 'nextclaw://panel-app/timer',
      url: '/api/panel-apps/timer/content',
    });
  });

  it('keeps panel app content URLs idempotent under panel app kind', () => {
    const resolver = new RightPanelResourceRouteResolver();

    expect(resolver.resolveOpenTarget({
      kind: 'panel-app',
      url: '/api/panel-apps/timer/content',
    })).toMatchObject({
      dedupeKey: 'panel-app:timer',
      kind: 'panel-app',
      resourceUri: 'nextclaw://panel-app/timer',
      url: '/api/panel-apps/timer/content',
    });
    expect(resolver.areUrlsEquivalent(
      'nextclaw://panel-app/timer',
      '/api/panel-apps/timer/content',
      'panel-app',
      'panel-app',
    )).toBe(true);
  });

  it('preserves an explicit panel app source path across resource and content URLs', () => {
    const resolver = new RightPanelResourceRouteResolver();
    const resourceUri = 'nextclaw://panel-app/timer?path=%2Ftmp%2Ftimer.panel';
    const contentUrl = '/api/panel-apps/timer/content?path=%2Ftmp%2Ftimer.panel';

    expect(resolver.resolve(resourceUri)).toMatchObject({
      dedupeKey: 'panel-app:/tmp/timer.panel',
      kind: 'panel-app',
      resourceUri,
      url: contentUrl,
    });
    expect(resolver.resolveOpenTarget({
      kind: 'panel-app',
      url: contentUrl,
    })).toMatchObject({
      dedupeKey: 'panel-app:/tmp/timer.panel',
      resourceUri,
      url: contentUrl,
    });
    expect(resolver.areUrlsEquivalent(
      resourceUri,
      contentUrl,
      'panel-app',
      'panel-app',
    )).toBe(true);
    expect(resolver.areUrlsEquivalent(
      resourceUri,
      'nextclaw://panel-app/timer?path=%2Ftmp%2Fother.panel',
      'panel-app',
      'panel-app',
    )).toBe(false);
  });
});
