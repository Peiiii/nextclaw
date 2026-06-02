import { describe, expect, it } from 'vitest';
import { RightPanelResourceRouteResolver } from '@/features/right-panel-resources';

describe('RightPanelResourceRouteResolver', () => {
  it('normalizes apps resources and keeps service apps distinct', () => {
    const resolver = new RightPanelResourceRouteResolver();

    expect(resolver.resolve('nextclaw://apps')).toMatchObject({
      dedupeKey: 'apps',
      kind: 'apps',
      url: 'nextclaw://apps',
    });
    expect(resolver.resolve('nextclaw://apps?tab=service-apps')).toMatchObject({
      dedupeKey: 'apps',
      kind: 'apps',
      url: 'nextclaw://apps?tab=service-apps',
    });
  });

  it('resolves nextclaw docs resources into docs targets', () => {
    const resolver = new RightPanelResourceRouteResolver();
    const target = resolver.resolve('nextclaw://docs/guide/getting-started');

    expect(target.kind).toBe('docs');
    expect(target.title).toBe('Help Docs');
    expect(target.url).toContain('/guide/getting-started');
  });

  it('resolves panel app resources to a stable target identity', () => {
    const resolver = new RightPanelResourceRouteResolver();

    expect(resolver.resolve('nextclaw://panel-app/timer')).toMatchObject({
      dedupeKey: 'panel-app:timer',
      kind: 'panel-app',
      url: 'nextclaw://panel-app/timer',
    });
  });
});
